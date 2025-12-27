import json
import glob
import os

# 匹配当前目录下所有 json 文件
json_files = glob.glob("./*.json")

if not json_files:
    print("No json files found.")
    exit(0)

for json_file in json_files:
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 转成一行 string（保证合法 JSON string）
    json_string = json.dumps(data, ensure_ascii=False)

    # 输出文件名：xxx.json -> xxx.txt
    txt_file = os.path.splitext(json_file)[0] + ".txt"

    with open(txt_file, "w", encoding="utf-8") as f:
        f.write(json_string)

    print(f"Converted: {json_file} -> {txt_file}")