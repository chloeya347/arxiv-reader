#!/bin/bash
eval "$(conda shell.bash hook)"
conda activate paperagent
python server.py
