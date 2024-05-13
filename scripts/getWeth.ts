// @ts-ignore
import { ethers, getNamedAccounts, network } from "hardhat";
import { networkConfig } from "../helper-hardhat-config";

export const AMOUNT = ethers.utils.parseEther("0.02");

export async function getWeth() {
  const { deployer } = await getNamedAccounts();

  // call the "deposite" function to get WETH FOR ETH
  const iWeth = await ethers.getContractAt(
    "IWeth",
    networkConfig[network.config!.chainId!].wethToken!,
    deployer
  );
  const tx = await iWeth.deposit({ value: AMOUNT });
  await tx.wait(1);

  const wethBalance = await iWeth.balanceOf(deployer);
  console.log(`Got ${wethBalance} WETH`);
}
