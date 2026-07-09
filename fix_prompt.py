import re

with open('ai/ui_agent.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 기존 주석 블록 + 구형 프롬프트 찾아서 교체
start_marker = '                # [번역 주석]'
end_marker = '                 """'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx) + len(end_marker)

if start_idx == -1:
    print("FAIL: start marker not found")
    print("Trying alternative search...")
    idx = content.find('You are an expert UI testing')
    print(f"  'You are an expert UI testing' at index: {idx}")
else:
    print(f"Found block: {start_idx} ~ {end_idx}")
    
    new_prompt = """                report_prompt = (
                    "You are a professional UI/UX auditor and web quality analyst.\\n"
                    f"Analyze the following AI autonomous exploration session on: {target_url}\\n\\n"
                    "Exploration Steps (JSON):\\n"
                    f"{history_str}\\n\\n"
                    "Write a comprehensive UX audit report IN KOREAN using this exact structure.\\n"
                    "Fill in all '?' with real assessments based on the exploration data.\\n\\n"
                    "# AI UI/UX \\uac10\\uc0ac \\ubcf4\\uace0\\uc11c\\n\\n"
                    "## \\ud0d0\\uc0c9 \\uac1c\\uc694\\n"
                    f"- \\ud14c\\uc2a4\\ud2b8 \\ub300\\uc0c1: {target_url}\\n"
                    "- \\uc218\\ud589 \\ub2e8\\uacc4 \\uc218: (\\uc2e4\\uc81c \\ub2e8\\uacc4 \\uc218)\\n"
                    "- \\ud0d0\\uc0c9 \\uc885\\ub8cc \\uc774\\uc720: (FINISH \\uba85\\ub839 \\ub610\\ub294 \\uc624\\ub958 \\ub4f1)\\n\\n"
                    "---\\n\\n"
                    "## \\uc815\\uc0c1 \\uc791\\ub3d9 \\ud655\\uc778 \\uc694\\uc18c\\n"
                    "(\\uac01 \\ud56d\\ubaa9\\uc744 \\ubd88\\ub9bf\\uc73c\\ub85c \\uad6c\\uccb4\\uc801\\uc73c\\ub85c \\uc11c\\uc220)\\n\\n"
                    "---\\n\\n"
                    "## \\ubc1c\\uacac\\ub41c \\ubb38\\uc81c\\uc810 \\ubc0f \\uac1c\\uc120 \\uc81c\\uc548\\n"
                    "(\\uac01 \\ud56d\\ubaa9\\ub9c8\\ub2e4 \\ubb38\\uc81c / \\uc6d0\\uc778 \\ucd94\\uc815 / \\uad6c\\uccb4\\uc801 \\uac1c\\uc120 \\ubc29\\ubc95 \\ud615\\uc2dd\\uc73c\\ub85c \\uc11c\\uc220)\\n\\n"
                    "---\\n\\n"
                    "## \\ud56d\\ubaa9\\ubcc4 \\ud3c9\\uac00 \\uc810\\uc218\\n\\n"
                    "| \\ud3c9\\uac00 \\ud56d\\ubaa9 | \\uc810\\uc218 (5\\uc810 \\ub9cc\\uc810) | \\ub4f1\\uae09 | \\ud55c\\uc904 \\ud3c9\\uac00 |\\n"
                    "|---|:---:|:---:|---|\\n"
                    "| \\ucd08\\uae30 \\ub85c\\ub529 \\uc18d\\ub3c4 | ? / 5 | \\uc0c1/\\uc911/\\ud558 | |\\n"
                    "| \\ub0b4\\ube44\\uac8c\\uc774\\uc158 \\uc9c1\\uad00\\uc131 | ? / 5 | \\uc0c1/\\uc911/\\ud558 | |\\n"
                    "| UI \\uc694\\uc18c \\uc811\\uadfc\\uc131 | ? / 5 | \\uc0c1/\\uc911/\\ud558 | |\\n"
                    "| \\uc0c1\\ud638\\uc791\\uc6a9 \\ubc18\\uc751\\uc131 | ? / 5 | \\uc0c1/\\uc911/\\ud558 | |\\n"
                    "| \\uc624\\ub958 \\ucc98\\ub9ac \\uc218\\uc900 | ? / 5 | \\uc0c1/\\uc911/\\ud558 | |\\n\\n"
                    "---\\n\\n"
                    "## \\uc885\\ud569 \\ud3c9\\uac00\\n\\n"
                    "- \\uc885\\ud569 \\uc810\\uc218: ? / 5.0\\n"
                    "- \\uc885\\ud569 \\ub4f1\\uae09: \\uc0c1 / \\uc911 / \\ud558 (\\ud558\\ub098\\ub9cc \\uc120\\ud0dd)\\n"
                    "- \\ud55c\\uc904 \\ucd1d\\ud3c9: (\\uac04\\uacb0\\ud558\\uac8c 1~2\\ubb38\\uc7a5)\\n\\n"
                    "---\\n\\n"
                    "## \\uc6b0\\uc120\\uc21c\\uc704\\ubcc4 \\uac1c\\uc120 \\uacfc\\uc81c\\n\\n"
                    "### [\\uc989\\uc2dc] High Priority\\n"
                    "(\\uc2ec\\uac01\\ud55c \\uc0ac\\uc6a9\\uc131 \\ubb38\\uc81c)\\n\\n"
                    "### [\\ub2e8\\uae30] Medium Priority\\n"
                    "(\\uac1c\\uc120\\ud558\\uba74 UX \\ud5a5\\uc0c1\\uc5d0 \\ub3c4\\uc6c0\\uc774 \\ub418\\ub294 \\ud56d\\ubaa9)\\n\\n"
                    "### [\\uc7a5\\uae30] Low Priority\\n"
                    "(\\uc788\\uc73c\\uba74 \\uc88b\\uc740 \\ud56d\\ubaa9)\\n\\n"
                    "Respond ONLY with the filled-in markdown. Do not wrap in code fences."
                )"""
    
    new_content = content[:start_idx] + new_prompt + content[end_idx:]
    
    with open('ai/ui_agent.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS: prompt replaced")
