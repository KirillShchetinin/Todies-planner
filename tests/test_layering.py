"""The frontend layer split is a rule, not a convention.

`index.html` loads plain scripts into one shared global scope, so nothing at
runtime stops common/ from calling into a renderer or the two renderers from
calling each other — the split is intentional and only holds while someone
checks it. That someone is this test.

Rules (frontend/README of record: CLAUDE.md):
  - common/  must never reference a symbol defined only in desktop/ or mobile/
  - desktop/ and mobile/ must never reference each other
"""
import os
import re

import pytest

FRONTEND = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend')

# Comments and quoted strings are prose, not references — a mention of
# "renderMobile" in a comment must not fail the check.
_NOISE = re.compile(r'/\*.*?\*/|//[^\n]*|\'(?:[^\'\\\n]|\\.)*\'|"(?:[^"\\\n]|\\.)*"', re.S)

# Top-level declarations are that file's exports (no modules, no bundler).
_DECL = re.compile(r'^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)', re.M)


def _layer(name):
    """{filename: code} for one layer, with comments and strings blanked out."""
    d = os.path.join(FRONTEND, name)
    return {f: _NOISE.sub(' ', open(os.path.join(d, f)).read())
            for f in sorted(os.listdir(d)) if f.endswith('.js')}


def _symbols(layer):
    return {m for src in layer.values() for m in _DECL.findall(src)}


@pytest.fixture(scope='module')
def layers():
    return {name: _layer(name) for name in ('common', 'desktop', 'mobile')}


@pytest.mark.parametrize('user, owner', [
    ('common', 'desktop'),
    ('common', 'mobile'),
    ('desktop', 'mobile'),
    ('mobile', 'desktop'),
])
def test_layer_does_not_reference(layers, user, owner):
    # A name the using layer defines itself is its own, whatever the other
    # layer calls things.
    foreign = _symbols(layers[owner]) - _symbols(layers[user])
    found = [
        f'{user}/{fname}: {sym}'
        for fname, src in layers[user].items()
        for sym in sorted(foreign)
        if re.search(rf'\b{re.escape(sym)}\b', src)
    ]
    assert found == [], f'{user}/ must not reference {owner}/ symbols'
