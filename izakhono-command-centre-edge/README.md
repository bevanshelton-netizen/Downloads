# IZAKHONO Command Centre EDGE Adapter

Small owner-hosted bridge between IZAKHONO RUNTIME/EDGE and the Command Gateway on port 8091.

Public path:

Internet -> IZAKHONO EDGE -> IZAKHONO RUNTIME -> this adapter -> Command Gateway -> CONTROL -> NODE

The adapter stores no credentials and performs no deployment decisions. The Command Gateway keeps owner authentication and CONTROL credentials behind the owner-host boundary.
