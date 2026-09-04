import CallbackRoute from '../models/CallbackRoute.js';
import { normalizePhone } from './plivoService.js';

export const saveCallbackRoute = async ({ callLog }) => {
  const customerNumber = normalizePhone(callLog?.customerNumber || callLog?.toNumber);
  const virtualNumber = normalizePhone(callLog?.virtualNumber || callLog?.fromNumber);
  if (!customerNumber || !virtualNumber || !callLog?.calledBy || !callLog?.lead) return null;

  return CallbackRoute.findOneAndUpdate(
    { customerNumber, virtualNumber },
    {
      $set: {
        employee: callLog.calledBy,
        lead: callLog.lead,
        leadModel: callLog.leadModel,
        lastOutboundCall: callLog._id,
        lastCalledAt: callLog.callDatetime || new Date(),
      },
      $setOnInsert: { customerNumber, virtualNumber },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

export const findCallbackRoute = async ({ customerNumber, virtualNumber }) => {
  const normalizedCustomer = normalizePhone(customerNumber);
  const normalizedVirtual = normalizePhone(virtualNumber);
  if (!normalizedCustomer || !normalizedVirtual) return null;
  return CallbackRoute.findOne({
    customerNumber: normalizedCustomer,
    virtualNumber: normalizedVirtual,
  }).lean();
};
