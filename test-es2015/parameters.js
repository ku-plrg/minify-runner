"use strict";
function test(x = "hello", { a, b }, ...args) {
  console.log(x, a, b, args);
}
