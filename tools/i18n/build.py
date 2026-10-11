import json, sys, runpy, os
lang = sys.argv[1]; out = sys.argv[2]
M = runpy.run_path(os.path.join(os.path.dirname(__file__), lang + '.py'))['M']
data = {k: {"message": v.replace('$', '$$').replace('$$1', '$1').replace('$$2', '$2').replace('$$3', '$3')} for k, v in M.items()}
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(data, open(out, 'w'), ensure_ascii=False, indent=1)
print(lang, len(data))

msgs = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(out))), 'lib', 'msgs')
os.makedirs(msgs, exist_ok=True)
open(os.path.join(msgs, lang + '.js'), 'w').write('// Generated from _locales/' + lang + '/messages.json (tools: i18n build). Do not edit by hand.\nexport default ' + json.dumps(M, ensure_ascii=False, indent=0) + ';\n')
