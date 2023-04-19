import json
import sys
import jsonpickle

class MethodMatch():

    def __init__(self, name, match) -> None:
        self.name = name
        self.match = match


methods: list[MethodMatch] = []
for arg in sys.argv[1:]:
    methods.append(MethodMatch("entity.name.function", f"(?<=\\s|^){arg}(?=\\s|$)"))

with open('methods.json', 'w') as outfile:
    sampleJson = jsonpickle.encode(methods, unpicklable=False, indent=4)
    outfile.write(sampleJson)
