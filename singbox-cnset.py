#!/usr/bin/env python3
import math
import urllib.request
from pathlib import Path

APNIC_URL = "https://ftp.apnic.net/stats/apnic/delegated-apnic-latest"
OUT_FILE = Path("./singbox-cnset.nft")

def ipv4_count_to_cidr(count: int) -> int:
    return 32 - int(math.log2(count))

def main():
    print("Downloading APNIC data...")
    data = urllib.request.urlopen(APNIC_URL, timeout=30).read().decode("utf-8")

    cidrs = []

    for line in data.splitlines():
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) < 7:
            continue

        registry, cc, rtype, start, value, *_ = parts

        if cc == "CN" and rtype == "ipv4":
            try:
                count = int(value)
                prefix = ipv4_count_to_cidr(count)
                cidrs.append(f"{start}/{prefix}")
            except Exception:
                pass

    cidrs = sorted(set(cidrs))

    print(f"Generating nft set with {len(cidrs)} CIDRs")

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with OUT_FILE.open("w") as f:
        f.write("set singbox_cn_ipv4 {\n")
        f.write("  type ipv4_addr\n")
        f.write("  flags interval\n")
        f.write("  elements = {\n")
        for c in cidrs:
            f.write(f"    {c},\n")
        f.write("  }\n")
        f.write("}\n")

    print(f"Done: {OUT_FILE}")

if __name__ == "__main__":
    main()