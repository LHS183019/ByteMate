#!/bin/bash
OUTPUT_FILE="POJPaw_Extension.zip"
# 如果存在旧的压缩包，先删除
if [ -f "$OUTPUT_FILE" ]; then
    rm "$OUTPUT_FILE"
fi

zip -r "$OUTPUT_FILE" . \
    -x "*.git*" \
    -x "backend/*" \
    -x "test/*" \
    -x "readme_asset/*" \
    -x "README.md" \
    -x "TODO.md" \
    -x "TELEMETRY.md" \
    -x "UNIT-TEST.md" \
    -x "PRIVACY_POLICY.md" \
    -x "package.json" \
    -x "package-lock.json" \
    -x "jest.config.js" \
    -x "coverage/*" \
    -x "tests/*" \
    -x "package_extension.ps1" \
    -x "*.DS_Store" \
    -x "package_extension.sh"

echo "打包完成！文件名为: $OUTPUT_FILE"
echo "您可以将此文件发送给用户。"
