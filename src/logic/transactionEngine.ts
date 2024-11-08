import { v4 as uuidv4 } from 'uuid';
import { getSplTransferById, createSplTransfer as createSplTransferInDb } from '@/services/db/queries/splTransfer';
import { TOKEN_PROGRAM_ADDRESS } from '@/services/rpcService';
import { SplTransfer, transactionStatuses } from '@/app/types/splTransfer';
import { getMintInfo } from '@/app/config/mint';
import { EmbeddedWallet, ix_TransferSPL } from '@/utils/EmbeddedWallet';
export async function getSplTransfer(id: string): Promise<SplTransfer | null> {
  return await getSplTransferById(id);
}

export async function createSplTransfer(sender: string, destination: string, amount: string, mintSymbol: string): Promise<SplTransfer> {
  const mint = getMintInfo(mintSymbol);
  const relayWallet = EmbeddedWallet.get();

  const RELAY_FEE = '500000'; // 0.50 USDC/USDT (6 decimal places)

  const ix_fee = await ix_TransferSPL(
    sender,
    await relayWallet.keymanager.getAddress(),
    RELAY_FEE,
    TOKEN_PROGRAM_ADDRESS,
    mint.address
  );

  const ix_transfer = await ix_TransferSPL(
    sender,
    destination,
    amount,
    TOKEN_PROGRAM_ADDRESS,
    mint.address
  );

  const splTransferTxn = await relayWallet.BuildTransaction(
    [ix_fee, ix_transfer], 
    await relayWallet.keymanager.getPublicKey()
  );

  await relayWallet.SignTransaction(splTransferTxn);

  const splTransfer: SplTransfer = {
    id: uuidv4(),
    sender,
    destination,
    amount,
    mint: mint.address,
    mintSymbol,
    unsignedTransactionBytes: Buffer.from(splTransferTxn.serialize()),
    currentStatus: transactionStatuses.INIT,
    feeInLamports: RELAY_FEE,
    feeInSpl: RELAY_FEE,
  };

  await createSplTransferInDb(splTransfer);

  // return serialized unsigned transaction bytes
  return splTransfer;
}