const TEMPLATE_TYPE = Symbol('template');
//region Utils
function zip(arrays) {
    const result = [];
    const firstLen = arrays[0].length;
    for (let i = 0; i < firstLen; i += 1) {
        result.push(arrays.map(a => a[i]));
    }
    return result;
}
function isBlank(l) {
    return l.values.length === 0 && l.parts.length === 1 && l.parts[0].trim() === '';
}
function isTemplate(v) {
    return v instanceof Object && TEMPLATE_TYPE in v;
}
function escapeRegExp(raw) {
    return raw.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
/** Template line with text only */
function textOnly(line) {
    return { parts: [line], values: [] };
}
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_LINE = new Proxy({}, {
    get() { return EMPTY_ARRAY; }
});
/** Convert an array of objects into an object of arrays, for easier use in {@link t templates}. */
function columnsFrom(obj) {
    const result = {};
    const items = obj.length;
    if (items === 0) {
        // Returns a proxy where every property returns an empty array
        return EMPTY_LINE;
    }
    const keys = Object.keys(obj[0]);
    for (const key of keys) {
        result[key] = [];
        for (let i = 0; i < items; i++) {
            result[key][i] = obj[i][key];
        }
    }
    return result;
}
//endregion
//region Parse
/** Convert a template string into an array of template strings, one for each line in the original. */
function splitToTemplateLines(parts, values) {
    const lines = [];
    // Split text before first injected expression into lines
    const initialLines = parts[0].split('\n').map(textOnly);
    lines.push(...initialLines);
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        // Add the injected expression to the last line
        const lastLine = lines[lines.length - 1];
        lastLine.values.push(value);
        // Text content afterward is split into lines, first of which appends to the last line
        const partsAfter = parts[i + 1].split('\n');
        lastLine.parts.push(partsAfter[0]);
        // The additional lines of text content (if any) can then generate new lines in the output
        lines.push(...partsAfter.slice(1).map(textOnly));
    }
    return {
        [TEMPLATE_TYPE]: true,
        lines,
    };
}
/** Creates a string template, that can later be converted to a plain string with {@link formatWith}. */
function t(parts, ...values) {
    return splitToTemplateLines(parts, values);
}
const DEFAULT_OPTIONS = { indentWith: '' };
/** Converts a string template to a plain string using the default options.
 *
 * @see formatWith
 */
function format(template) {
    return formatWith(DEFAULT_OPTIONS, template);
}
/**
 * Converts a string template to a plain string.
 *
 * @param options            Formatting options
 * @param options.indentWith Replace baseline indents with this in the output. Defaults to an empty string.
 * @param template           The string template to process
 */
function formatWith(options, template) {
    return formatLines(options, template).join('\n');
}
function formatLines(options, template) {
    const indentWith = options.indentWith ?? '';
    // Remove leading and trailing empty lines
    const firstNonBlank = template.lines.findIndex(l => !isBlank(l));
    const lastNonBlank = template.lines.findLastIndex(l => !isBlank(l));
    if (firstNonBlank === -1 || lastNonBlank === -1) {
        // All lines are blank
        return [];
    }
    const withoutBlankLines = template.lines.slice(firstNonBlank, lastNonBlank + 1);
    const firstLine = withoutBlankLines[0];
    const INDENT_EXPR = /^\s*/;
    const oldIndentMatch = INDENT_EXPR.exec(firstLine.parts[0]);
    const oldIndent = oldIndentMatch ? oldIndentMatch[0] : '';
    // The indent is whitespace only, so escaping shouldn't do anything... but might as well
    const oldIndentRegex = new RegExp("^" + escapeRegExp(oldIndent));
    let processed = withoutBlankLines
        .flatMap(l => {
            // Same text parts as in the original with the indent changed
            const reindented = [...l.parts];
            reindented[0] = reindented[0].replace(oldIndentRegex, indentWith);
            // Arrays: repeat rows for each item
            if (l.values.length === 1 && Array.isArray(l.values[0])) {
                const embedded = [];
                for (const item of l.values[0]) {
                    // Templates are converted to their individual rows first
                    if (isTemplate(item)) {
                        const lines = formatLines(DEFAULT_OPTIONS, item);
                        for (const line of lines) {
                            embedded.push(line);
                        }
                    }
                    else {
                        embedded.push(item);
                    }
                }
                return embedded.map(e => String.raw({ raw: reindented }, e));
            }
            // Multiple arrays: repeat rows for each combination
            else if (l.values.length >= 1
                && l.values.every(v => Array.isArray(v))
                && l.values.every(v => v.length === l.values[0].length)) {
                const zipped = zip(l.values);
                return zipped.map(values => {
                    return String.raw({ raw: reindented }, ...values);
                });
            }
            // Embedded templates: render to lines, repeat row for each line
            else if (l.values.length === 1 && isTemplate(l.values[0])) {
                const lines = formatLines(options, l.values[0]);
                return lines.map(v => {
                    return String.raw({ raw: reindented }, v);
                });
            }
            // Regular values
            else {
                const interpolated = String.raw({ raw: reindented }, ...l.values);
                return [interpolated];
            }
        });
    // Remove final line if it was just a line break with indent
    if (processed.length && processed[processed.length - 1] === indentWith) {
        processed.length -= 1;
    }
    return processed;
}
/**
 * Joins an array of items into multiple lines, limited to a given length.
 *
 * (Known limitation: the line length limit can be exceeded if the trailing string is longer than the line separator)
 *
 * @param items             The list of elements to organize into lines
 * @param options           Various options to configure the output
 * @param options.maxLength Maximum number of characters on a line
 * @param options.separator Separator characters between individual items. Defaults to `, `
 * @param options.lineEnd   Separator characters between lines. Defaults to `separator.trimEnd()`
 * @param options.trailing  Terminator characters after the last line. Defaults to `lineEnd`
 */
function join(items, options) {
    const separator = options.separator ?? ', ';
    const lineEnd = options.lineEnd ?? separator.trimEnd();
    const trailing = options.trailing ?? lineEnd;
    const maxLength = options.maxLength ?? 0;
    const outLines = [];
    if (items.length === 0) {
        return [];
    }
    // No length limit means it's the same as a regular join
    if (maxLength === 0) {
        return [items.join(separator)];
    }
    const itemLengths = items.map(i => i.length);
    let startIndex = 0;
    let endIndex = 0;
    // Check if we have more items to add
    while (startIndex < items.length) {
        // Always add at least one item to the output.
        endIndex += 1;
        // NOTE: This assumes that the line-ending and trailing strings are the same length.
        //       Avoids the need to check if we're on the final line or not, but can cause overflow on the last line.
        let availableSpace = maxLength - lineEnd.length - itemLengths[startIndex];
        // Add more items while we still have space
        while (endIndex <= items.length && availableSpace >= itemLengths[endIndex] + separator.length) {
            availableSpace -= itemLengths[endIndex];
            endIndex += 1;
        }
        // Line filled up, add it to the output
        const lineSegment = items.slice(startIndex, endIndex);
        outLines.push(lineSegment.join(separator));
        startIndex = endIndex;
    }
    // Add line-ending / trailing separators
    return outLines.map(((l, index) => {
        const terminator = index === outLines.length - 1 ? trailing : lineEnd;
        return l + terminator;
    }));
}
//endregion
export { t, formatWith, format, columnsFrom, join };
export { TEMPLATE_TYPE };
//# sourceMappingURL=templating.js.map