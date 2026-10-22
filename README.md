# анализатор цикломатической сложности функций
считает количество тривиальных исходов функции

```typescript
function f() {} // 1

function s(x: number) {
    if (x == 1) return 1;
    if (x == 2) return 2;
    return 3;
} // 3
```