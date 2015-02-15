/*jslint vars: true, plusplus: false, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window, SPECIFICITY */

define(function (require, exports, module) {
    "use strict";

    require("thirdparty_modules/specificity/specificity");
    var CommandManager = brackets.getModule("command/CommandManager"),
        EditorManager  = brackets.getModule("editor/EditorManager"),
        KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
        Menus          = brackets.getModule("command/Menus"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        CSSUtils       = brackets.getModule("language/CSSUtils");

    function filterSelectors(selectors, document) {
        var filteredSelectors = {},
            i;
   
        function findMediaQuery(selector) {
            var line,
                i;
            
            for (i = selector.selectorStartLine; i > 0; i = i - 1) {
                line = document.getLine(i);
                if (line.charAt(0) === '@') {
                    return line;
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
            var s1 = SPECIFICITY.calculate(a.name);
            var s2 = SPECIFICITY.calculate(b.name);

            var a1 = s1[0].specificity.split(',');
            var b1 = s2[0].specificity.split(',');

            for (i = 0; i < a1.length; i = i + 1) {
                if (a1[i] > b1[i]) {
                    return 1;
                } else if (a1[i] < b1[i]) {
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
        
        function combineLines(selector, ranges) {
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
                    
                    text = text + ranges[j].mediaQuery + '\n';
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
        
        for (i = 0; i < selectors.length; i = i + 1) {
            // Might have empty indexes
            if (selectors[i]) {
                selectorName = selectors[i].name + " { \n";
                documentText = documentText + combineLines(selectorName, selectors[i].ranges);
            }
        }

        return documentText;
    }
    
    // Function to run when the menu item is clicked
    function unify(sortMethod) {
        var editor = EditorManager.getFocusedEditor();
        
        if (editor) {
            var insertionPos = editor.getCursorPos();
            var text = editor.document.getText();

            var selectors = CSSUtils.extractAllSelectors(text);
            var filtered = filterSelectors(selectors, editor.document);
            var sorted = sortMethod(filtered);
            
            editor.document.setText(combineSelectors(sorted, editor.document));
        }
    }

    function runIndex() {
        unify(sortSelectorsByIndex);
    }

    function runSpecificity() {
        unify(sortSelectorsBySpecificity);
    }

    // First, register a command - a UI-less object associating an id to a handler
    var MY_COMMAND_ID1 = "olofbjerke.brackets-unify-css-selectors.index";
    var MY_COMMAND_ID2 = "olofbjerke.brackets-unify-css-selectors.specificity";
    CommandManager.register("Unify css selectors and sort by appearance", MY_COMMAND_ID1, runIndex);
    CommandManager.register("Unify css selectors and sort by specificity", MY_COMMAND_ID2, runSpecificity);
    KeyBindingManager.addBinding(MY_COMMAND_ID1, "Shift-Ctrl-U");
    
    // Then create a menu item bound to the command
    // The label of the menu item is the name we gave the command (see above)
    var menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
    menu.addMenuItem(MY_COMMAND_ID1);
    menu.addMenuItem(MY_COMMAND_ID2);
});
