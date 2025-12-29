def chat_by_qwen(msg_list):
    API_KEY = 'MDc2MGUzZWMtMzhiNy00NWRhLWFiMWItNTAxMzliZWE5NWIx'
    headers = {
        'X-GATEWAY-APIKEY': f'Bearer{API_KEY}',
        'Content-Type': 'application/json'
    }
    payload = {
        'messages': msg_list,
        'max_tokens': 4096,
        'repetition_penalty': 1,
        'temperature': 0.7,
        'top_p': 0.5
    }
    url = 'https://opensseapi.cmhk.com/CMHK-LMMP-PRD_Qwen_72B_128K/CMHK-LMMP-PRD/v1/chat/completions'
    response = requests.post(url, headers=headers, json=payload, timeout=60, verify=False)
    if response.status_code == 200:
        raw_response = response.json()['choices'][0]['message']['content']
        return raw_response
    else:
        print(f'请求失败：{response.status_code}')
        print(response.text)
        return "[]"
