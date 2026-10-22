"""A required gate must execute tests, with no failures, errors or skips."""
import sys
from pathlib import Path
from xml.etree import ElementTree


def validate(path):
    root = ElementTree.parse(path).getroot()
    cases = list(root.iter('testcase'))
    if not cases:
        raise ValueError('No test cases executed')
    if any(list(root.iter(tag)) for tag in ('failure', 'error', 'skipped')):
        raise ValueError('A required test failed, errored or skipped')
    return len(cases)


if __name__ == '__main__':
    for name in sys.argv[1:]:
        print(f'{Path(name).name}: {validate(name)} executed, zero failures/errors/skips')
