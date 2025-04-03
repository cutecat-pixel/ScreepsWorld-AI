#!/bin/bash

# Screeps高级部署脚本
# 用法: ./deploy-advanced.sh [分支名称] [服务器类型]
# 例如: ./deploy-advanced.sh simulation
#       ./deploy-advanced.sh dev season

echo "===== Screeps高级部署脚本 ====="

# 加载环境变量
if [ -f ".env" ]; then
    echo "加载环境变量..."
    export $(cat .env | xargs)
fi

# 默认配置
DEFAULT_BRANCH=${SCREEPS_BRANCH:-"default"}
DEFAULT_SERVER="main" # main是普通服务器，season是季节服务器

# 分支名称 (第一个参数，如未提供则使用default)
BRANCH=${1:-$DEFAULT_BRANCH}

# 服务器类型 (第二个参数，如未提供则使用main)
SERVER=${2:-$DEFAULT_SERVER}

echo "将部署到: 分支[$BRANCH] 服务器[$SERVER]"
echo "确认部署? (y/n)"
read confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "部署已取消"
    exit 0
fi

# 检查环境
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

if [ ! -f "Gruntfile.js" ]; then
    echo "错误: 未找到Gruntfile.js，请确保你在正确的项目根目录"
    exit 1
fi

# 确认依赖已安装
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
fi

# 设置环境变量
export SCREEPS_BRANCH=$BRANCH

# 修改Gruntfile.js中的分支和服务器配置
echo "正在配置部署设置..."

# 临时备份Gruntfile.js
cp Gruntfile.js Gruntfile.js.bak

# 根据服务器类型更新Gruntfile.js
if [ "$SERVER" == "season" ]; then
    # 启用season服务器配置
    sed -i "s/\/\/server: 'season'/server: 'season'/" Gruntfile.js
else
    # 禁用season服务器配置
    sed -i "s/server: 'season'/\/\/server: 'season'/" Gruntfile.js
fi

# 运行部署命令
echo "正在部署代码到分支[$BRANCH] 服务器[$SERVER]..."
npm run deploy

# 检查上次命令的退出状态
DEPLOY_RESULT=$?

# 恢复Gruntfile.js
mv Gruntfile.js.bak Gruntfile.js

# 根据部署结果输出信息
if [ $DEPLOY_RESULT -eq 0 ]; then
    echo "===== 部署成功完成! ====="
    echo "代码已成功部署到Screeps账户的[$BRANCH]分支 (服务器: $SERVER)"
else
    echo "===== 部署失败! ====="
    echo "请检查错误信息并解决问题"
    exit 1
fi

exit 0 