import jsonpickle
import sys


class SnippetParrent(object):

    def __init__(self, name, description, prefix, body):
        vars(self)[name] = Snippet(description, prefix, body)

class Snippet():

    def __init__(self, description, prefix, body):
        self.description = description
        self.prefix = prefix
        self.body = body

def replace_numbered(str: str, replace: dict[str, str]):
    max = 100
    curr = 0
    currReplaceCount = 0
    while(curr < max):
        curr += 1
        completed = True
        smalesIndex = len(str)
        targetString = ''
        replaceString = ''
        for target, replacer in replace.items():
            try:
                if str.index(target) < smalesIndex:
                    smalesIndex = str.index(target)
                    targetString = target
                    replaceString = replacer
                    completed = False
            except:
                continue
        if completed:
            break
        currReplaceCount += 1
        str = str.replace(targetString, replaceString.replace('$x', f'${currReplaceCount}'), 1)
    return str
                    




typeReplacers = {
    "%register": "&r$x",
    "%number": "$x",
    "%address": "*$x",
    "%variable": "*$x",
    "%label": "~$x",
}

with open(''.join([x+' ' for x in sys.argv[1:]]), 'r') as infile:
    instructions: list[str] = jsonpickle.decode(infile.read())
    snippets: dict[str, Snippet] = {}

    for arg in instructions:
        if all(arg.find(t) == -1 for t in typeReplacers.keys()):
            continue
        snippets[arg.split(' ')[0]] = Snippet(
            arg,
            [ arg.split(' ')[0] ],
            [ replace_numbered(arg, typeReplacers) ]
        )

    with open('snipppets.json', 'w') as outfile:
        sampleJson = jsonpickle.encode(snippets, unpicklable=False, indent=4)
        outfile.write(sampleJson)
        outfile.close()
