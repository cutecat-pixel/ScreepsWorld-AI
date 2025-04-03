#!/bin/bash

# Screeps部署脚本
echo "===== 开始部署Screeps代码 ====="
echo "正在检查环境..."

# 检查node和npm是否安装
if ! command -v node &> /dev/null; then
    echo "错误: Node.js未安装，请先安装Node.js"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "错误: npm未安装，请先安装npm"
    exit 1
fi

# 确认项目目录结构正确
if [ ! -d "dist" ]; then
    echo "错误: 未找到dist目录，请确保你在正确的项目根目录"
    exit 1
fi

# 确认依赖已安装
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
fi

# 如果有.env文件，加载环境变量
if [ -f ".env" ]; then
    echo "加载环境变量..."
    export $(cat .env | xargs)
fi

# 运行部署命令
echo "正在部署代码..."
npm run deploy

# 检查上次命令的退出状态
if [ $? -eq 0 ]; then
    echo "===== 部署成功完成! ====="
    echo "代码已成功部署到Screeps账户"
else
    echo "===== 部署失败! ====="
    echo "请检查错误信息并解决问题"
    exit 1
fi

exit 0 