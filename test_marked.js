import { marked } from 'marked';
const res = marked('hello');
console.log('Result type:', typeof res);
if (res instanceof Promise) {
  console.log('Is Promise');
} else {
  console.log('Is not Promise');
}
