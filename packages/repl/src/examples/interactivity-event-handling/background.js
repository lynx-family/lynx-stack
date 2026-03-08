// The background thread receives events dispatched by __AddEvent string handlers
// via the publishEvent RPC mechanism.
//
// In the React runtime, these are routed to component event handlers.
// For this raw demo, we listen on the "event" endpoint and relay back.

// Note: In a real framework, you would register event handlers differently.
// This example shows the low-level publishEvent → background flow.
