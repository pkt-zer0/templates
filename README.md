# Slightly better templates

## Motivation

The built-in string templating functionality of JavaScript is great for generating text or code, and with a few small
additions, can do basically everything I'd want it to. The main thing missing was handling whitespace and indentation
sensibly, both in the input and output, so your source code and the generated text can both have appropriate formatting.

Couldn't find an existing library that does that, so here we are.

## Usage

Add `templating.ts` to your project, use its exports as needed.
There are some automated tests in `test.ts`, and a usage example in `example.ts`.  

## Features

Tagged template literals are used to create the templated strings, which can then be formatted with various options:

```javascript
import { t, format } from './templating';

format(t`Hello, World!`, { indentWith: '---' });
/* =>
---Hello, World!
*/
```

Indentation from the first non-blank line is used as a baseline, so it can match its surrounding context without
changing the output.

```javascript
format(t`

    Greetings,
        Earth!

`);
/* =>
Greetings,
    Earth!
*/
```

Interpolating expressions works the same way as in vanilla template strings:

```javascript
format(t`Testing ${1 + 2}`) // => Testing 3
```

Interpolating arrays repeats the containing line for each item in the array:

```javascript
format(t`
${[1, 2]} fish
    ${['red', 'blue']} fish
`)
/* =>
1 fish
2 fish
    red fish
    blue fish
*/
```

This works with multiple equal-length arrays as well:

```javascript
const cols = ['A', 'B'];
const rows = ['1', '2'];
format(t`${cols} - ${rows}`)
/* =>
A - 1
B - 2
*/
```

A small utility can rearrange arrays-of-objects into objects-of-arrays to make this easier:

```javascript
const { x, y } = columnsFrom([
    { x: 'A', y: '1' },
    { x: 'B', y: '2' },
]);
format(t`${x} - ${y}`)
/* =>
A - 1
B - 2
*/
```

Interpolating templates (or arrays of them) also works without any extra fuss:

```javascript
const items = [1, 2, 3];
format(t`
START
    ${items.map(i => t`
        item ${i} 
    `)}
END
`);
/* =>
START
    item 1
    item 2
END
*/
```

Slightly better joins allow you to break long lists of items into lines in a pleasing way. Lines can be limited by total
length, and the various separators are also customizable.  

```javascript
const items = [1, 2, 3, 4];
join(items, { maxLength: 5, separator: ', ', lineEnd: ';', trailing: '.' });
/* =>
1, 2;
3, 4.
*/
```

...And that's all! For more details, check the comments in the code.