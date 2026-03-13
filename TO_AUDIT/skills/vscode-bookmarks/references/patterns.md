# Bookmark Labelling Patterns

Choose a pattern based on what the user wants to navigate. Patterns can be combined in a single bookmarks.json.

## 1. Data Flow (trace data from origin to destination)

Best for: authentication flows, message pipelines, request/response cycles, event propagation.

Labels follow the data chronologically. Prefix = the thing being traced.

```
TOKEN:CREATED     -> server signs JWT
TOKEN:STORED      -> client saves to sessionStorage
TOKEN:SENT-REST   -> client attaches to fetch Authorization header
TOKEN:SENT-WS     -> client sets socket.auth
TOKEN:RECEIVED    -> server reads from handshake
TOKEN:VERIFIED    -> server validates signature + expiry
```

```
MSG:EMIT          -> client socket.emit('message:send')
MSG:VALIDATE      -> server validates text
MSG:PERSIST       -> server writes to DB
MSG:BROADCAST     -> server io.to(room).emit()
MSG:LISTEN        -> client socket.on('message:received')
MSG:DISPATCH      -> client dispatches to reducer
MSG:REDUCE        -> reducer processes action
```

Naming: `NOUN:VERB` -- what the thing is, then what happens to it at this point.

## 2. Responsibility (group by what each module does)

Best for: understanding architecture, onboarding, code reviews.

Labels group by domain. Prefix = the domain/concern.

```
AUTH:REST          -> REST endpoint for login
AUTH:SIGN          -> JWT signing function
AUTH:VERIFY        -> JWT verification function
AUTH:MIDDLEWARE     -> Socket.IO auth middleware
AUTH:GUARD         -> REST route authentication helper
```

```
DB:CONNECT         -> database initialization
DB:MIGRATE         -> schema migrations
DB:INSERT          -> write operations
DB:QUERY           -> read operations
DB:CLEANUP         -> TTL sweep / garbage collection
```

```
ROUTE:HOME         -> / handler
ROUTE:AUTH         -> /api/auth handler
ROUTE:ROOMS        -> /api/rooms handler
ROUTE:MESSAGES     -> /api/rooms/:code/messages handler
```

Naming: `DOMAIN:ASPECT` -- the concern area, then the specific responsibility.

## 3. Lifecycle (trace an entity through its states)

Best for: connection management, session handling, component mounting, resource lifecycle.

Labels follow temporal order. Prefix = the entity.

```
SOCKET:CREATE      -> io() creates socket instance
SOCKET:AUTH        -> set auth token
SOCKET:CONNECT     -> socket.connect()
SOCKET:JOINED      -> room:join confirmed
SOCKET:DISCONNECT  -> disconnect event
SOCKET:RECONNECT   -> auto-reconnect from sessionStorage
```

```
ROOM:CREATE        -> POST /api/rooms
ROOM:JOIN          -> socket room:join handler
ROOM:PRESENCE      -> room manager tracks users
ROOM:LEAVE         -> user leaves / disconnects
ROOM:CLEANUP       -> TTL sweep removes stale rooms
```

Naming: `ENTITY:STATE` -- the thing, then where it is in its lifecycle.

## 4. Layer (mark the same operation at each architectural layer)

Best for: understanding how a single action crosses boundaries (UI -> hook -> context -> socket -> server -> DB).

Labels use the layer as prefix, operation as suffix.

```
UI:SEND-MSG        -> MessageInput component submit handler
HOOK:SEND-MSG      -> useChat or custom hook
CTX:SEND-MSG       -> ChatContext/ChatProvider
WS:SEND-MSG        -> socket.emit
API:SEND-MSG       -> server socket handler
DB:SEND-MSG        -> addMessage INSERT
```

Naming: `LAYER:OPERATION` -- the architectural layer, then the operation being performed.

## 5. Error Path (trace error handling for a feature)

Best for: debugging, resilience review, interview questions about error handling.

```
ERR:VALIDATE       -> input validation throws
ERR:AUTH-FAIL      -> JWT verification fails
ERR:SOCKET-ERR     -> socket connect_error handler
ERR:ROOM-ERR       -> room:error event handler
ERR:CATCH          -> try/catch in handler
ERR:TOAST          -> error displayed to user
```

Naming: `ERR:LOCATION` -- always ERR prefix, then where the error is handled.

## Combining Patterns

A single bookmarks.json can use multiple patterns. The alphabetical sorting in the sidebar naturally groups them:

```
AUTH:MIDDLEWARE     (responsibility)
AUTH:REST           (responsibility)
AUTH:SIGN           (responsibility)
CONNECT:AUTO       (lifecycle)
CONNECT:MANUAL     (lifecycle)
MSG:BROADCAST      (data flow)
MSG:DISPATCH       (data flow)
MSG:EMIT           (data flow)
TOKEN:CREATED      (data flow)
TOKEN:SENT-WS      (data flow)
```

## Choosing a Pattern

| User says | Pattern |
|-----------|---------|
| "How does X get from A to B?" | Data Flow |
| "What does this module do?" | Responsibility |
| "What happens when X connects/disconnects?" | Lifecycle |
| "How does this cross the client/server boundary?" | Layer |
| "What happens when X fails?" | Error Path |
| "I need to explain this in an interview" | Data Flow + Responsibility combo |
