# Unify CSS selectors
This small extension was created to hande CSS files where identical selectors are spread out throughout the document.

```css
.example-class {
    color: red;
}

.example-class {
    padding: 1em;
}

.example-class1 {
    color: green;
}

@media all and (min-width: 10em) {
    .example-class1 {
        color: magenta;
    }

    .example-class {
        color: magenta;
    }
}

```
Is converted into
```css
.example-class { 
    color: red;
    padding: 1em;
}

@media all and (min-width: 10em) {
	.example-class { 
        color: magenta;
	}
}

.example-class1 { 
    color: green;
}

@media all and (min-width: 10em) {
	.example-class1 { 
        color: magenta;
	}
}
```
## How to use
Go to Edit > "Unify css selectors" or press Shift+Ctrl+U

The contents of the current document will be swapped with the result.

## What is happening behind the scenes
1. Go through all selectors in the document
1. Create a dictionary with all unique selectors
    - If a key already exists, add the line range to it.
    - If the selector is nested (part of media query) add the media query
1. Go through all unique selectors and list all rules for them
    - Base selector is printed first
    - Media queries covering the selector is placed next to the selector.
1. Replace the contents of the document with the merged selectors

## Note
- Media queries are stored under each selector
- :hover, :active etc. are splitted into separate groups
- Comments on top of selectors are not preserved