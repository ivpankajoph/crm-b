let socketServer;
let socketRegistry;

export const configureRealtime = (io, userSockets) => {
  socketServer = io;
  socketRegistry = userSockets;
};

export const emitToUsers = (userIds, eventName, payload) => {
  if (!socketServer || !socketRegistry) return 0;
  let delivered = 0;
  for (const userId of userIds || []) {
    const sockets = socketRegistry.get(String(userId));
    if (!sockets) continue;
    const socketIds = sockets instanceof Set ? sockets : new Set([sockets]);
    for (const socketId of socketIds) {
      socketServer.to(socketId).emit(eventName, payload);
      delivered += 1;
    }
  }
  return delivered;
};
