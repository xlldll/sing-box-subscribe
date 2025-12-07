# test_vless.py
# 用来测试 vless.parse 是否按预期输出 sing-box 1.12.12 风格的节点字典
# test_vless.py

import os, sys

# 计算项目根目录：.../项目根/parsers_test/vless_test.py → .../项目根
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

import json
from parsers.vless import parse

def pretty_print(title, data):
    print("=" * 60)
    print(title)
    print("-" * 60)
    if data is None:
        print("parse() 返回了 None（解析失败）")
    else:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    print()

def main():
    # 你可以在这里放真实的 vless:// 链接（把敏感信息换成假的也行）
    # 示例 1：Reality + TLS + uTLS + WS
    sample1 = (
        "vless://311f32f9-ab81-4ef0-80f8-7e7730ec4b54"
        "@111.250.125.24:8443"
        "?security=reality"
        "&flow=xtls-rprx-vision"
        "&sni=www.python.org"
        "&client-fingerprint=chrome"
        "&pbk=2a0ONLRiBeHJdr9qCruq5tPVf8_3c4fmZsg7YQorFSE"
        "&sid=04d59340"
        "&type=ws"
        "&path=/ray?ed=2048"
        "#vless台湾01"
    )

    # 示例 2：普通 TLS + WS，无 Reality，有指纹
    sample2 = (
        "vless://aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        "@example.com:443"
        "?security=tls"
        "&sni=www.example.com"
        "&client-fingerprint=chrome"
        "&type=ws"
        "&path=/ws"
        "#普通TLS节点"
    )

    # 示例 3：gRPC + Reality，无 uTLS
    sample3 = (
        "vless://ffffffff-1111-2222-3333-444444444444"
        "@1.2.3.4:8443"
        "?security=reality"
        "&sni=www.python.org"
        "&pbk=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        "&sid=1234abcd"
        "&type=grpc"
        "&serviceName=grpc-service"
        "#gRPC Reality 节点"
    )

    samples = [
        ("Sample 1: Reality + TLS + uTLS + WS", sample1),
        ("Sample 2: TLS + uTLS + WS (no Reality)", sample2),
        ("Sample 3: Reality + gRPC (no uTLS)", sample3),
    ]

    for title, s in samples:
        node = parse(s)
        pretty_print(title, node)


if __name__ == "__main__":
    main()