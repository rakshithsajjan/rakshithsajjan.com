import { marked } from 'marked';
const res = marked('# hello');
console.log('Result:', res);
console.log('Type:', typeof res);
if (res instanceof Promise) {
    console.log('Is Promise');
    console.log('Resolved:', await res);
}
