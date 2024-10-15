// menu.rs is the corresponding Rust file.
//
// The rust will emit events when menu items are selected
// The frontend needs to handle these events, and ensure 
// we dispose of listeners correctly
// 
// My current strategy is to bind the listener dispose function 
// to a ref, and store that ref in the root route.

