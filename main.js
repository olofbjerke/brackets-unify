/*jslint vars: true, plusplus: false, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {
    "use strict";

    var CommandManager = brackets.getModule("command/CommandManager"),
        EditorManager  = brackets.getModule("editor/EditorManager"),
        KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
        Menus          = brackets.getModule("command/Menus"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        CSSUtils       = brackets.getModule("language/CSSUtils");
        
    function filterSelectors(selectors, document) {
        var filteredSelectors = {},
            i;

        /*
        
        FIRST .test SELECTOR
        declListEndChar: 0
        declListEndLine: 12
        declListStartChar: 6
        declListStartLine: 8
        level: 0
        parentSelectors: ""
        ruleStartChar: 1
        ruleStartLine: 8
        selector: ".test"
        selectorEndChar: 5
        selectorEndLine: 8
        selectorGroupStartChar: 0
        selectorGroupStartLine: -1
        selectorStartChar: 0
        selectorStartLine: 8
        
        BODY INSIDE MEDIA Query
        declListEndChar: 4
        declListEndLine: 4
        1declListStartChar: 9
        declListStartLine: 39
        level: 1
        parentSelectors: ""
        ruleStartChar: 5
        ruleStartLine: 39
        selector: "body"
        selectorEndChar: 8
        selectorEndLine: 39
        selectorGroupStartChar: 4
        selectorGroupStartLine: -1
        selectorStartChar: 4
        selectorStartLine: 39
        
        */
        
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

    function sortSelectors(filteredSelectors) {

        var sortedSelectors = [],
            key;

        for (key in filteredSelectors) {
            if (filteredSelectors.hasOwnProperty(key)) {
                var obj = filteredSelectors[key];
                sortedSelectors[obj.index] = obj;
            }
        }

        return sortedSelectors;
    }

    function combineSelectors(selectors, document) {
        var documentText = "",
            i,
            j,
            k,
            start,
            end,
            line,
            mediaQueries,
            selectorName;
        
        function combineLines(selector, ranges) {
            var text = "",
                j,
                k,
                line,
                start,
                end,
                baseExists = false;
            
            // Check if base selector exists
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
    function unify() {
        var editor = EditorManager.getFocusedEditor();
        var document;
        
        if (editor) {
            document = editor.document;
            var insertionPos = editor.getCursorPos();
            var text = document.getText();

            var selectors = CSSUtils.extractAllSelectors(text);
            var filtered = filterSelectors(selectors, document);
            var sorted = sortSelectors(filtered);
            
            document.setText(combineSelectors(sorted, document));
        }
    }


    // First, register a command - a UI-less object associating an id to a handler
    var MY_COMMAND_ID = "unifyCssSelectors.unify";   // package-style naming to avoid collisions
    CommandManager.register("Unify all css selectors", MY_COMMAND_ID, unify);
    KeyBindingManager.addBinding(MY_COMMAND_ID, "Shift-Cmd-I");
    
    // Then create a menu item bound to the command
    // The label of the menu item is the name we gave the command (see above)
    var menu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
    menu.addMenuItem(MY_COMMAND_ID);

    // We could also add a key binding at the same time:
    //menu.addMenuItem(MY_COMMAND_ID, "Ctrl-Alt-H");
    // (Note: "Ctrl" is automatically mapped to "Cmd" on Mac)
});