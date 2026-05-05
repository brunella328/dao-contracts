import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  AuditStarted, VoteCast, AuditFinalized
} from "../../generated/AuditVoting/AuditVoting";
import { AuditSession, AuditVote } from "../../generated/schema";

export function handleAuditStarted(event: AuditStarted): void {
  let session = new AuditSession(event.params.taskId.toString());
  session.auditors = event.params.auditors.map<Bytes>(a => a as Bytes);
  session.passVotes = 0;
  session.failVotes = 0;
  session.finalized = false;
  session.createdAt = event.block.timestamp;
  session.result = null;
  session.save();
}

export function handleVoteCast(event: VoteCast): void {
  let session = AuditSession.load(event.params.taskId.toString());
  if (!session) return;
  if (event.params.pass) session.passVotes += 1;
  else session.failVotes += 1;
  session.save();

  let voteId = event.params.taskId.toString() + "-" + event.params.auditor.toHex();
  let vote = new AuditVote(voteId);
  vote.taskId = event.params.taskId;
  vote.auditor = event.params.auditor;
  vote.pass = event.params.pass;
  vote.timestamp = event.block.timestamp;
  vote.save();
}

export function handleAuditFinalized(event: AuditFinalized): void {
  let session = AuditSession.load(event.params.taskId.toString());
  if (!session) return;
  session.finalized = true;
  session.result = event.params.passed;
  session.save();
}
