# Readme
This small extension was created to hande CSS files where identical selectors are spread out throughout the document. 

```css
.example {
    color: red;
}

.example {
    padding: green;
}
```
Is converted into
```css
.example {
    color: red;
    padding: green;
}

```
## How to use
Go to Edit > Unify css selectors
The contents of the current document will be swapped with the result.

## Process
1. Go through all selectors in the document
1. Create a dictionary with all unique selectors
    - If a key already exists, add the line range to it.
1. Replace the contents of the document with the merged selectors

## Note
- Media queries(!) are ignored
- :hover, :active etc. are splitted into separate groups
- Comments on top of selectors are not preserved
