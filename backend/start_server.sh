#!/bin/bash

# 设置变量
VENV_DIR="$(dirname "$0")/venv"
REQUIREMENTS="$(dirname "$0")/requirements.txt"
APP_FILE="$(dirname "$0")/app.py"

# 检查虚拟环境是否存在，如果不存在则创建
if [ ! -d "$VENV_DIR" ]; then
    echo "创建虚拟环境..."
    python3 -m venv "$VENV_DIR"
    if [ $? -ne 0 ]; then
        echo "创建虚拟环境失败，请检查 Python 安装"
        exit 1
    fi
    echo "虚拟环境创建成功"
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source "$VENV_DIR/bin/activate"
if [ $? -ne 0 ]; then
    echo "激活虚拟环境失败"
    exit 1
fi

# 升级 pip 并安装 setuptools
echo "升级 pip 并安装基础依赖..."
pip install --upgrade pip setuptools wheel
if [ $? -ne 0 ]; then
    echo "升级 pip 失败"
    exit 1
fi

# 安装依赖
echo "安装依赖..."
pip install -r "$REQUIREMENTS"
if [ $? -ne 0 ]; then
    echo "安装依赖失败"
    exit 1
fi
echo "依赖安装成功"

# 启动服务器
echo "启动服务器..."
uvicorn app:app --host 0.0.0.0 --port 8000 --reload