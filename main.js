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
        
    function filterSelectors(selectors) {
        var filteredSelectors = {},
            i;

        function filterSelector(index, selector) {
            if (!filteredSelectors[selector.selector]) {
                filteredSelectors[selector.selector] = {
                    'name': selector.selector,
                    'index': index,
                    'ranges': []
                };
            }
            filteredSelectors[selector.selector]
                .ranges.push({'lineStart': selector.declListStartLine, 'lineEnd': selector.declListEndLine});
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
        var text = "",
            i,
            j,
            k,
            start,
            end,
            line;
        
        for (i = 0; i < selectors.length; i = i + 1) {
            if (selectors[i]) {
                text = text + selectors[i].name + " { \n";
                for (j = 0; j < selectors[i].ranges.length; j = j + 1) {
                    start = selectors[i].ranges[j].lineStart;
                    end = selectors[i].ranges[j].lineEnd;
                    for (k = start + 1; k <= end - 1; k = k + 1) {
                        line = document.getLine(k);
                        text = text + line + "\n";
                    }
                }

                text = text + "} \n\n";
            }
        }

        return text;
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
            var filtered = filterSelectors(selectors);
            var sorted = sortSelectors(filtered);
            
            console.log(selectors);
            
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