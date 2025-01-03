import baretest from 'baretest';
import assert from 'node:assert';
import { format, formatWith, join, columnsFrom, t, Template, TemplateLine } from './templating';

type TestCase = [string, Template, string];

function lines(...strings: string[]): string {
    return strings.join('\n');
}

const suites: any[] = []; // FIXME: types

// Output formatting
{
    const OPTS = { indentWith: '' };
    const CASES: TestCase[] = [
        ['Basics', t`Number ${42}`, 'Number 42'],
        ['Multiline', t`List ${[1, 2, 3]}`, lines(
            'List 1',
            'List 2',
            'List 3'
        )],
        ['Multiarray', t`Pos ${['A', 'B']} - ${[1, 2]}`, lines(
            'Pos A - 1',
            'Pos B - 2',
        )],
        ['Indent removal', t`    Test`, 'Test'],
        ['Newline removal', t`
            Test
        `, 'Test'],
        ['Newline removal 2', t`

        Test

        `, 'Test'],
        ['Newline removal 3', t`


        Test


        `, 'Test'],
        ['Newline removal 4', t`

        AAA

        BBB
    
        `, lines('AAA', '', 'BBB')],
        ['Indent preservation', t`
        START
            Item #${[1, 2]}
        END
        `,
        lines(
            'START',
            '    Item #1',
            '    Item #2',
            'END',
        )],
        ['Nested templates', t`
        START
            ${t`
            sub A
                item #${[1, 2]}
            `}
        END
        `,
        lines(
            'START',
            '    sub A',
            '        item #1',
            '        item #2',
            'END',
        )],
        ['Nested template arrays', t`
        START
            ${[t`
                sub A
                    item #${[1, 2]}
            `, t`
                sub B
                    item #${[3, 4]}
            `
        ]}
        END
        `,
            lines(
                'START',
                '    sub A',
                '        item #1',
                '        item #2',
                '    sub B',
                '        item #3',
                '        item #4',
                'END',
            )
        ],
        ['Mixed nested templates and values', t`
        START
            ${[t`
                sub A
                    item #${[1, 2]}
            `, `sub B`
        ]}
        END
        `,
            lines(
                'START',
                '    sub A',
                '        item #1',
                '        item #2',
                '    sub B',
                'END',
            )
        ],
    ];

    const test = baretest('Format');
    suites.push(test);

    for (const [name, input, expected] of CASES) {
        test(name, () => {
            const actual = formatWith(OPTS, input);

            assert.equal(actual, expected);
        });
    }

    test('Default options', () => {
        const actual = format(t`
            Test
        `);
        assert.equal(actual, 'Test');
    });
    test('Custom indent', () => {
        const actual = formatWith({ indentWith: '##' }, t`
            Test
        `);
        assert.equal(actual, '##Test');
    });
    test('Line transformation', () => {
        const rows = [
            { x: 'a', y: 1 },
            { x: 'b', y: 2 },
        ];

        const expected = {
            x: ['a', 'b'],
            y: [ 1,   2 ],
        };
        const actual = columnsFrom(rows);
        assert.deepEqual(actual, expected);
    });
}

// Initial parsing
{
    function x(parts: TemplateStringsArray, ...values: unknown[]): TemplateLine {
        return { parts, values };
    }

    const test = baretest('Parse');
    suites.push(test);

    const CASES = [
        ['One line', t`AA ${1} BB`, [x`AA ${1} BB`]],
        ['Wrapping lines', t`
AA ${1} BB
`,
            [
                x``,
                x`AA ${1} BB`,
                x``,
            ]
        ],
        ['Two lines, two values', t`
AA ${1} BB
CC ${2} DD
`,
            [
                x``,
                x`AA ${1} BB`,
                x`CC ${2} DD`,
                x``,
            ]
        ],
        ['Two lines, multiple values', t`
AA ${1} BB ${2} CC
CC ${3} DD
`,
            [
                x``,
                x`AA ${1} BB ${2} CC`,
                x`CC ${3} DD`,
                x``,
            ]
        ],
        ['Two lines, text-only intermission', t`
AA ${1} BB ${2} CC
DD
EE ${3} FF
`,
            [
                x``,
                x`AA ${1} BB ${2} CC`,
                x`DD`,
                x`EE ${3} FF`,
                x``,
            ]
        ],
    ] as const;

    for (const [name, input, expected] of CASES) {
        test(name, () => {
            assert.deepEqual(input.lines, expected);
        });
    }
}

// Join utilities
{
    const test = baretest('Join');
    suites.push(test);

    function trim(parts: TemplateStringsArray, ...values: unknown[]): string {
        return format(t(parts, ...values));
    }

    const CASES = [
        ['Length check', ['aaa', 'bbb', 'ccc'], { separator: ',', maxLength: 10 },
        trim`
            aaa,bbb,
            ccc,
        `],
        ['Custom separators', 'abcdef'.split(''), { separator: ', ', lineEnd: ';', trailing: '.', maxLength: 5 },
        trim`
            a, b;
            c, d;
            e, f.
        `],
    ] as const;

    for (const [name, input, options, expected] of CASES) {
        test(name, () => {
            const actual = join(input, options).join('\n');
            assert.equal(actual, expected);
        });
    }

}

!(async function() {
    console.time();
    for (const suite of suites) {
        await suite.run();
    }
    console.timeEnd();
})();