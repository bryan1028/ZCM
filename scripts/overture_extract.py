#!/usr/bin/env python3
"""
Extract restaurants and cafes for the cities in scripts/cities.json from the Overture Maps places dataset
(open data, CDLA-Permissive-2.0; keep the "© Overture Maps Foundation" credit). Writes one JSON object per line,
ready for scripts/import-places-jsonl.ts. Reads only the Parquet row groups that overlap each city.

  pip install pyarrow s3fs phonenumbers
  python3 scripts/overture_extract.py --out data/overture-places.jsonl [--per-city 150] [--only Lagos,Paris] [--release 2026-09-23.1]

Quality rules: open (not closed), confidence >= 0.5, has a name AND (a phone OR a website). A number is only marked
as WhatsApp when it is a MOBILE number in a country where WhatsApp is the default messenger; everything else stays a
plain phone (shown as Call, never as Message).
"""
import argparse, json, os, re, sys, time
import pyarrow as pa, pyarrow.compute as pc, pyarrow.parquet as pq, s3fs, phonenumbers

os.environ.setdefault("AWS_CA_BUNDLE", "/root/.ccr/ca-bundle.crt") if os.path.exists("/root/.ccr/ca-bundle.crt") else None
WA = set("NG GH KE ZA UG TZ ET RW EG MA DZ TN SN CI CM AE SA QA KW OM BH JO LB IL TR IN PK BD LK NP ID MY SG PH TH BR MX AR CO CL PE EC UY VE ES IT DE NL GB FR PT CH AT BE IE SE AU NZ GR PL RO".split())
FOOD_L2 = {"restaurant", "casual_eatery", "non_alcoholic_beverage_venue"}

def clean_cuisine(cat):
    if not cat or cat in ("restaurant", "food_and_drink", "eatery", "casual_eatery"): return None
    return re.sub(r"_restaurant$", "", cat).replace("_", " ")

def phone_info(raw, region):
    for r in (None, region):
        try:
            n = phonenumbers.parse(raw, r)
            if not phonenumbers.is_valid_number(n): continue
            digits = f"{n.country_code}{n.national_number}"
            mobile = phonenumbers.number_type(n) == phonenumbers.PhoneNumberType.MOBILE
            return digits, mobile, phonenumbers.region_code_for_number(n)
        except Exception:
            continue
    return None, False, None

def diets_for(cats, name):
    d = set(); blob = " ".join(cats).lower(); nm = name.lower()
    if "vegan" in blob or re.search(r"\bvegan\b", nm): d |= {"vegan", "vegetarian"}
    if "vegetarian" in blob or re.search(r"\bvegetarian\b", nm): d.add("vegetarian")
    if "halal" in blob or re.search(r"\bhalal\b", nm): d.add("halal")
    if "kosher" in blob or re.search(r"\bkosher\b", nm): d.add("kosher")
    if "gluten_free" in blob or re.search(r"gluten[- ]free", nm): d.add("gluten_free")
    return sorted(d)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cities", default=os.path.join(os.path.dirname(__file__), "cities.json"))
    ap.add_argument("--out", default="data/overture-places.jsonl")
    ap.add_argument("--per-city", type=int, default=150)
    ap.add_argument("--only", default="")
    ap.add_argument("--release", default="2026-09-23.1")
    a = ap.parse_args()
    cities = json.load(open(a.cities))
    if a.only: keep = {c.strip().lower() for c in a.only.split(",")}; cities = [c for c in cities if c["city"].lower() in keep]

    fs = s3fs.S3FileSystem(anon=True, client_kwargs={"region_name": "us-west-2"})
    prefix = f"overturemaps-us-west-2/release/{a.release}/theme=places/type=place/"
    files = sorted(fs.ls(prefix))
    t0 = time.time(); meta = []
    for fp in files:
        f = pq.ParquetFile(fp, filesystem=fs); md = f.metadata; ix = {md.schema.column(i).path: i for i in range(md.num_columns)}
        rgs = []
        for rg in range(md.num_row_groups):
            r = md.row_group(rg); st = lambda k: r.column(ix[k]).statistics
            rgs.append((rg, st("bbox.xmin").min, st("bbox.xmax").max, st("bbox.ymin").min, st("bbox.ymax").max))
        meta.append((fp, rgs))
    print(f"read {len(files)} file footers in {time.time()-t0:.1f}s", file=sys.stderr)

    cols = ["id", "confidence", "websites", "phones", "addresses", "names", "operating_status", "taxonomy", "bbox"]
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    total = 0
    with open(a.out, "w", encoding="utf8") as out:
        for c in cities:
            t1 = time.time(); r = c.get("r", 0.12)
            bb = (c["lon"] - r, c["lat"] - r, c["lon"] + r, c["lat"] + r)
            tabs = []
            for fp, rgs in meta:
                for rg, x0, x1, y0, y1 in rgs:
                    if x1 < bb[0] or x0 > bb[2] or y1 < bb[1] or y0 > bb[3]: continue
                    tabs.append(pq.ParquetFile(fp, filesystem=fs).read_row_group(rg, columns=cols))
            if not tabs: print(f"{c['city']}: no data", file=sys.stderr); continue
            tb = pa.concat_tables(tabs); bx = tb.column("bbox").combine_chunks()
            xs, ys = pc.struct_field(bx, "xmin"), pc.struct_field(bx, "ymin")
            inside = pc.and_(pc.and_(pc.greater_equal(xs, bb[0]), pc.less_equal(xs, bb[2])), pc.and_(pc.greater_equal(ys, bb[1]), pc.less_equal(ys, bb[3])))
            tb = tb.filter(pc.and_(inside, pc.greater_equal(tb.column("confidence"), 0.5)))
            picked = []
            for row in tb.to_pylist():
                tax = row["taxonomy"] or {}
                h = tax.get("hierarchy") or []
                if len(h) < 2 or h[0] != "food_and_drink" or h[1] not in FOOD_L2: continue
                if (row["operating_status"] or "open") != "open": continue
                name = ((row["names"] or {}).get("primary") or "").strip()
                if not name: continue
                phones = row["phones"] or []; sites = row["websites"] or []
                if not phones and not sites: continue
                digits, mobile, region = (None, False, None)
                if phones: digits, mobile, region = phone_info(phones[0], c["country"])
                if not digits and not sites: continue
                cats = [tax.get("primary") or ""] + (tax.get("alternates") or []) + h
                cuisines = [x for x in dict.fromkeys(clean_cuisine(k) for k in [tax.get("primary")] + (tax.get("alternates") or [])) if x][:3]
                addr = (row["addresses"] or [{}])[0] or {}
                picked.append({
                    "id": row["id"], "name": name, "country": c["country"], "city": c["city"], "address": addr.get("freeform"),
                    "lat": round(row["bbox"]["ymin"], 6), "lon": round(row["bbox"]["xmin"], 6),
                    "phone": digits, "whatsapp": digits if (digits and mobile and region in WA) else None, "website": sites[0] if sites else None,
                    "cuisines": cuisines, "diets": diets_for(cats, name),
                    "rank": round(row["confidence"] + (0.1 if sites else 0) + (0.05 if digits else 0), 3),
                })
            picked.sort(key=lambda p: -p["rank"])
            picked = picked[: a.per_city]
            for p in picked: out.write(json.dumps(p, ensure_ascii=False) + "\n")
            total += len(picked)
            wa = sum(1 for p in picked if p["whatsapp"]); ph = sum(1 for p in picked if p["phone"])
            print(f"{c['city']:<14} {c['country']}  kept {len(picked):>3}  (phone {ph}, whatsapp-capable {wa}, website {sum(1 for p in picked if p['website'])})  {time.time()-t1:.0f}s", file=sys.stderr)
    print(f"TOTAL {total} places -> {a.out}", file=sys.stderr)

if __name__ == "__main__":
    main()
