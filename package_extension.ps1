$outputFile = "POJPaw_Extension.zip"

# 如果存在旧的压缩包，先删除
if (Test-Path $outputFile) {
    Remove-Item $outputFile
}

# 需要排除的文件/文件夹模式
$exclude = @(
    "*.git*",
    "backend/*",
    "test/*",
    "tests/*",
    "node_modules/*",
    "readme_asset/*",
    "README.md",
    "TODO.md",
    "UNITTEXT.md",
    "*.DS_Store",
    "package_extension.sh",
    "package_extension.ps1",
    "package-lock.json",
    "package.json",
    "jest.config.js"
)

# 获取当前目录下的所有文件，排除指定模式
# 注意：PowerShell 的 Compress-Archive 不支持复杂的排除模式，
# 这里我们简单地打包所有内容，然后用户可能需要手动清理，或者使用更复杂的脚本。
# 为了简单起见，我们只打包核心文件夹和文件。

$filesToZip = @(
    "manifest.json",
    "api",
    "assets",
    "background",
    "content",
    "dashboard",
    "popup",
    "problemset",
    "prompts"
)

Compress-Archive -Path $filesToZip -DestinationPath $outputFile -Force

Write-Host "打包完成！文件名为: $outputFile"
