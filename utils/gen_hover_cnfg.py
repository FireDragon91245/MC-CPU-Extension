import jsonpickle
import sys

class Hover():

    def __init__(self, aliases, value) -> None:
        self.aliases = aliases
        self.value = value


methods: list[Hover] = []
for arg in sys.argv[1:]:
    methods.append(Hover([arg], [f"# {arg}", "```mccpu", f"  {arg}", "```"]))

with open('hover.json', 'w') as outfile:
    sampleJson = jsonpickle.encode(methods, unpicklable=False, indent=4)
    outfile.write(sampleJson)
