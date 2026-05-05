import { BigInt } from "@graphprotocol/graph-ts";
import {
  DIDRegistered, DIDRevoked, CreditUpdated
} from "../../generated/DIDRegistry/DIDRegistry";
import { DIDRecord } from "../../generated/schema";

export function handleDIDRegistered(event: DIDRegistered): void {
  let did = new DIDRecord(event.params.agent.toHex());
  did.stakedAmount = event.params.stake;
  did.creditScore = BigInt.fromI32(100);
  did.registeredAt = event.params.timestamp;
  did.active = true;
  did.tasksCompleted = 0;
  did.tasksAudited = 0;
  did.save();
}

export function handleDIDRevoked(event: DIDRevoked): void {
  let did = DIDRecord.load(event.params.agent.toHex());
  if (!did) return;
  did.active = false;
  did.stakedAmount = BigInt.fromI32(0);
  did.save();
}

export function handleCreditUpdated(event: CreditUpdated): void {
  let did = DIDRecord.load(event.params.agent.toHex());
  if (!did) return;
  did.creditScore = event.params.newScore;
  did.save();
}
