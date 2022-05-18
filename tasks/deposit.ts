import { task } from 'hardhat/config'
import { abi } from '../artifacts/contracts/GisDAOVoting.sol/GisDAOVoting.json'


task("deposit", "Deposit tokens to DAO")
    .addParam("contract", "Contract address")
    .addParam("amount", "Amount of tokens")
    .setAction(async (taskArgs, { ethers }) => {
        const [signer] = await ethers.getSigners()
        const contract = taskArgs.contract
        const amount = taskArgs.amount
        const gisDaoVoting = new ethers.Contract(
            contract,
            abi,
            signer
        )

        const tx = await gisDaoVoting.deposit(amount)
        console.log(tx)
    })