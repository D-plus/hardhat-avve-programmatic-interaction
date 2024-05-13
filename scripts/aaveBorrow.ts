// @ts-ignore
import { ethers, getNamedAccounts, network } from "hardhat";
import { BigNumber } from "ethers";
import { Address } from "hardhat-deploy/dist/types";

import { AMOUNT, getWeth } from "./getWeth";
import { networkConfig } from "../helper-hardhat-config";

export async function main() {
  // the aave protocol treats everything as a ERC20 token
  const { deployer } = await getNamedAccounts();
  await getWeth();

  const lendingPool = await getLendingPool(deployer);
  console.log("lendingPool address ", lendingPool.address);

  // aprove and deposit collateral

  // approve lending pool address to use our wethToken ADDRESS tokens
  await approveErc20(
    networkConfig[network.config!.chainId!].wethToken!,
    lendingPool.address,
    AMOUNT,
    deployer
  );

  console.log("Depositing...");
  await lendingPool.deposit(
    networkConfig[network.config!.chainId!].wethToken!,
    AMOUNT,
    deployer,
    0
  );
  console.log("Deposited!");

  // Borrow
  let { totalDebtETH, availableBorrowsETH } = await getBorrowUserAccountData(
    lendingPool,
    deployer
  );
  const daiPrice = await getDaiPrice();
  const amountDaiToBorrow =
    Number(availableBorrowsETH.toString()) * 0.95 * (1 / daiPrice); // 0.95 means we borrow 95% of the amount available to borrow (availableBorrowsETH)
  console.log(`You can borrow ${amountDaiToBorrow} DAI`);

  const amountDaiToBorrowWei = ethers.utils.parseEther(
    amountDaiToBorrow.toString()
  );
  await borrowDai(
    networkConfig[network.config!.chainId!].daiToken!,
    lendingPool,
    amountDaiToBorrowWei.toString(),
    deployer
  );

  await getBorrowUserAccountData(lendingPool, deployer);

  // Repay
  // To repay we need to approve sending DAI to aave
  await approveErc20(
    networkConfig[network.config!.chainId!].daiToken!,
    lendingPool.address,
    amountDaiToBorrowWei.toString(),
    deployer
  );

  await repay(
    networkConfig[network.config!.chainId!].daiToken!,
    lendingPool,
    amountDaiToBorrowWei,
    deployer
  );

  await getBorrowUserAccountData(lendingPool, deployer);
}

async function repay(daiAddress, lendingPool, amount, account) {
  const tx = await lendingPool.repay(daiAddress, amount, 2, account);
  await tx.wait(1);
  console.log("Borrowed DAI Repaid!");
}

async function borrowDai(
  daiAddress: Address,
  lendingPool,
  amountDaiToBorrowWei: string,
  account
) {
  const tx = await lendingPool.borrow(
    daiAddress,
    amountDaiToBorrowWei,
    2,
    0,
    account
  );
  await tx.wait(1);
  console.log("You've borrowed..!");
}

async function getDaiPrice(): Promise<number> {
  // DAI/ETH ChainLink pair price feed address: 0x773616E4d11A78F511299002da57A0a94577F1f4
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    "0x773616E4d11A78F511299002da57A0a94577F1f4"
  ); // we do not provide signer since we are going only reading from the contract and not sending transaction

  const price = (await daiEthPriceFeed.latestRoundData())[1];
  console.log(`DAI/ETH price is ${price}`);

  return price;
}

async function getBorrowUserAccountData(
  lendingPool,
  deployer
): Promise<{ totalDebtETH: string; availableBorrowsETH: string }> {
  const { totalCollateralETH, availableBorrowsETH, totalDebtETH } =
    await lendingPool.getUserAccountData(deployer);

  console.log(`You have ${totalCollateralETH} worth of ETH deposited.`);
  console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`);
  console.log(`You borrowed ${totalDebtETH} worth of ETH.`);

  return { totalDebtETH, availableBorrowsETH };
}

/**
 *
 * @param erc20ContractAddress
 * @param spenderAddress is an address of the spender who we give the approve to spend amount from our account
 * @param amount the amount to spend
 */
async function approveErc20(
  erc20ContractAddress: string,
  spenderAddress: string,
  amount: BigNumber,
  account: Address
) {
  const erc20TokenContract = await ethers.getContractAt(
    "IERC20",
    erc20ContractAddress,
    account
  );
  const tx = await erc20TokenContract.approve(spenderAddress, amount);
  await tx.wait(1);
  console.log("Approved!");
}

async function getLendingPool(deployer) {
  // LendingPoolAddressesProvider address: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    deployer
  );

  const lendingPoolAddress =
    await lendingPoolAddressesProvider.getLendingPool();

  return await ethers.getContractAt(
    "ILendingPool",
    lendingPoolAddress,
    deployer
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
