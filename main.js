/*jslint vars: true, plusplus: false, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window, SPECIFICITY */

define(function (require, exports, module) {
    "use strict";

    require("thirdparty_modules/specificity/specificity");
    var CommandManager      = brackets.getModule("command/CommandManager"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        KeyBindingManager   = brackets.getModule("command/KeyBindingManager"),
        Menus               = brackets.getModule("command/Menus"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        CSSUtils            = brackets.getModule("language/CSSUtils");

    var mediaQueries = [];
    var convertToSass = false;

    function filterSelectors(selectors, document) {
        var filteredSelectors = {},
            i;
   
        function mediaQuery(string) {
            var key;

            // Cleaning
            string = string.toLowerCase();
            string = string.replace('{', '');
            string = string.replace('@media', '');
            string = string.trim();

            // Add to dictionary
            if (mediaQueries[string]) {
                key = mediaQueries[string].id;
                mediaQueries[string].count = mediaQueries[string].count + 1;
            } else {
                mediaQueries[string] = {
                    id: "$mediaQuery" + (Object.keys(mediaQueries).length + 1),
                    query: string,
                    count: 1
                };

                key = mediaQueries[string].id;
            }

            if (!convertToSass) {
                key = string;
            }

            return key;
        }

        function findMediaQuery(selector) {
            var line,
                i;
            
            for (i = selector.selectorStartLine; i > 0; i = i - 1) {
                line = document.getLine(i);
                if (line.charAt(0) === '@' && line.charAt(1).toLowerCase() === 'm') {
                    return mediaQuery(line);
                }
            }
            
            return null;
        }
        
        function filterSelector(index, selector) {
            var range;
            
            // Selector already exists
            if (!filteredSelectors[selector.selector]) {
                filteredSelectors[selector.selector] = {
                    'name': selector.selector,
                    'index': index,
                    'ranges': []
                };
            }
            
            range = {
                'lineStart': selector.declListStartLine,
                'lineEnd': selector.declListEndLine
            };
            
            // Has a parent, eg a media query?
            if (selector.level > 0) {
                range.mediaQuery = findMediaQuery(selector);
            }
            
            
            filteredSelectors[selector.selector].ranges.push(range);
        }

        for (i = 0; i < selectors.length; i = i + 1) {
            filterSelector(i, selectors[i]);
        }

        return filteredSelectors;
    }

    // selectors is a dictionary with unique selectors
    function sortSelectorsByIndex(selectors) {

        var sortedSelectors = [],
            key;

        for (key in selectors) {
            if (selectors.hasOwnProperty(key)) {
                var obj = selectors[key];
                sortedSelectors[obj.index] = obj;
            }
        }

        return sortedSelectors;
    }

    // selectors is a dictionary with unique selectors
    function sortSelectorsBySpecificity(selectors) {
        var sortedSelectors = sortSelectorsByIndex(selectors);

        function compareSpecificity(a, b) {
            var i;
            a = SPECIFICITY.calculate(a.name);
            b = SPECIFICITY.calculate(b.name);

            a = a[0].specificity.split(',');
            b = b[0].specificity.split(',');

            for (i = 0; i < a.length; i = i + 1) {
                if (a[i] > b[i]) {
                    return 1;
                } else if (a[i] < b[i]) {
                    return -1;
                }
            }

            return 0;
        }

        sortedSelectors.sort(compareSpecificity);

        return sortedSelectors;
    }

    function combineSelectors(selectors, document) {
        var documentText = "",
            selectorName,
            i;
        
        function combineCssLines(selector, ranges) {
            var text = "",
                j,
                k,
                line,
                start,
                end,
                baseExists = false;
            
            // Check if base selector exists
            // Otherwise the base selector will be empty
            for (j = 0; j < ranges.length; j = j + 1) {
                if (!ranges[j].mediaQuery) {
                    baseExists = true;
                }
            }
            
            if (baseExists) {
                // Start of selector
                text = text + selector;

                // Create the base first time
                for (j = 0; j < ranges.length; j = j + 1) {
                    if (!ranges[j].mediaQuery) {
                        start = ranges[j].lineStart;
                        end = ranges[j].lineEnd;
                        for (k = start + 1; k <= end - 1; k = k + 1) {
                            line = document.getLine(k);
                            text = text + line + "\n";
                        }
                    }
                }

                // End Base
                text = text + '}\n\n';
            }
            
            // Create the Media queries second time
            for (j = 0; j < ranges.length; j = j + 1) {
                if (ranges[j].mediaQuery) {
                    
                    if (convertToSass) {
                        text = text + "@media #{" + ranges[j].mediaQuery + '} {\n';
                    } else {
                        text = text + "@media " + ranges[j].mediaQuery + ' {\n';
                    }

                    text = text + '\t' + selector;
                    
                    start = ranges[j].lineStart;
                    end = ranges[j].lineEnd;
                    for (k = start + 1; k <= end - 1; k = k + 1) {
                        line = document.getLine(k);
                        text = text + line + "\n";
                    }
                    
                    // Close selector
                    text = text + '\t}\n';
                    
                    // Close media query
                    text = text + '}\n\n';
                }
            }
        
            return text;
        }
        
        function combineSassLines(selector, ranges) {
            var text = "",
                j,
                k,
                line,
                start,
                end,
                baseExists = false;

            // Check if base selector exists
            // Otherwise the base selector will be empty
            for (j = 0; j < ranges.length; j = j + 1) {
                if (!ranges[j].mediaQuery) {
                    baseExists = true;
                }
            }

            if (baseExists) {
                // Start of selector
                text = text + selector;

                // Create the base first time
                for (j = 0; j < ranges.length; j = j + 1) {
                    if (!ranges[j].mediaQuery) {
                        start = ranges[j].lineStart;
                        end = ranges[j].lineEnd;
                        for (k = start + 1; k <= end - 1; k = k + 1) {
                            line = document.getLine(k);
                            text = text + line + "\n";
                        }
                    }
                }

                // Create the Media queries second time
                for (j = 0; j < ranges.length; j = j + 1) {
                    if (ranges[j].mediaQuery) {

                        if (convertToSass) {
                            text = text + "\n\t@media #{" + ranges[j].mediaQuery + '} {\n';
                        } else {
                            text = text + "\t@media " + ranges[j].mediaQuery + ' {\n';
                        }

                        text = text + '\t\t& {\n';

                        start = ranges[j].lineStart;
                        end = ranges[j].lineEnd;
                        for (k = start + 1; k <= end - 1; k = k + 1) {
                            line = document.getLine(k).trim();
                            text = text + '\t\t\t' + line + "\n";
                        }

                        // Close selector
                        text = text + '\t\t}\n';
                        // Close media query
                        text = text + '\t}\n';
                    }
                }

                // End Base
                text = text + '}\n\n';
            } else {
                // Create the Media queries second time
                for (j = 0; j < ranges.length; j = j + 1) {
                    if (ranges[j].mediaQuery) {

                        if (convertToSass) {
                            text = text + "@media #{" + ranges[j].mediaQuery + '} {\n';
                        } else {
                            text = text + "@media " + ranges[j].mediaQuery + ' {\n';
                        }

                        text = text + '\t' + selector;

                        start = ranges[j].lineStart;
                        end = ranges[j].lineEnd;
                        for (k = start + 1; k <= end - 1; k = k + 1) {
                            line = document.getLine(k).trim();
                            text = text + '\t\t' + line + "\n";
                        }

                        // Close selector
                        text = text + '\t}\n';

                        // Close media query
                        text = text + '}\n\n';
                    }
                }
            }

            return text;
        }

        function printMediaQueries() {
            var key,
                text = "";

            for (key in mediaQueries) {
                if (mediaQueries.hasOwnProperty(key)) {
                    var obj = mediaQueries[key];
                    text = text + obj.id + ": \"" + obj.query + "\"; \/\/ used " + obj.count + " times\n";
                }
            }

            return text;
        }

        if (convertToSass) {
            documentText = documentText + printMediaQueries() + "\n\n";
        }

        for (i = 0; i < selectors.length; i = i + 1) {
            // Might have empty indexes
            if (selectors[i]) {
                selectorName = selectors[i].name + " { \n";

                if (convertToSass) {
                    documentText = documentText + combineSassLines(selectorName, selectors[i].ranges);
                } else {
                    documentText = documentText + combineCssLines(selectorName, selectors[i].ranges);
                }
            }
        }

        return documentText;
    }
    
    // Function to run when the menu item is clicked
    function unify(sortMethod) {
        var editor = EditorManager.getFocusedEditor();
        
        if (editor) {
            // Reset list of media queries
            mediaQueries = [];
            var insertionPos = editor.getCursorPos();
            var text = editor.document.getText();

            var selectors = CSSUtils.extractAllSelectors(text);
            var filtered = filterSelectors(selectors, editor.document);
            var sorted = sortMethod(filtered);
            
            editor.document.setText(combineSelectors(sorted, editor.document));
        }
    }

    function runIndexAndConvertToSass() {
        convertToSass = true;
        unify(sortSelectorsByIndex);
    }

    function runIndex() {
        convertToSass = false;
        unify(sortSelectorsByIndex);
    }

    function runSpecificity() {
        convertToSass = false;
        unify(sortSelectorsBySpecificity);
    }

    // First, register a command - a UI-less object associating an id to a handler
    var COMMAND_1 = "olofbjerke.brackets-unify-css-selectors.index";
    var COMMAND_2 = "olofbjerke.brackets-unify-css-selectors.specificity";
    var COMMAND_3 = "olofbjerke.brackets-unify-css-selectors.sass";
    CommandManager.register("Unify css selectors and sort by appearance", COMMAND_1, runIndex);
    CommandManager.register("Unify css selectors and sort by specificity", COMMAND_2, runSpecificity);
    CommandManager.register("Unify css selectors and convert to Sass", COMMAND_3, runIndexAndConvertToSass);
    KeyBindingManager.addBinding(COMMAND_1, "Shift-Ctrl-U");
    
    // Then create a menu item bound to the command
    // The label of the menu item is the name we gave the command (see above)
    var menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
    menu.addMenuItem(COMMAND_1);
    menu.addMenuItem(COMMAND_2);
    menu.addMenuItem(COMMAND_3);
});
