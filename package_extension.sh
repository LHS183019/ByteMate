#!/bin/bash

# 定义输出文件名
OUTPUT_FILE="ByteMate_Extension.zip"

# 如果存在旧的压缩包，先删除
if [ -f "$OUTPUT_FILE" ]; then
    rm "$OUTPUT_FILE"
fi

# 创建压缩包，排除不必要的文件和文件夹
# -r: 递归
# -x: 排除匹配的文件
zip -r "$OUTPUT_FILE" . \
    -x "*.git*" \
    -x "backend/*" \
    -x "test/*" \
    -x "readme_asset/*" \
    -x "README.md" \
    -x "TODO.md" \
    -x "*.DS_Store" \
    -x "package_extension.sh"

echo "打包完成！文件名为: $OUTPUT_FILE"
echo "您可以将此文件发送给用户。"
