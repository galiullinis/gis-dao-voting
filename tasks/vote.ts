import { task } from 'hardhat/config'
import { abi } from '../artifacts/contracts/GisDAOVoting.sol/GisDAOVoting.json'


task("vote", "Vote for proposal")
    .addParam("contract", "Contract address")
    .addParam("proposalId", "The proposal ID")
    .addParam("agreement", "The agreement with proposal. True - agree, false - not agree")
    .setAction(async (taskArgs, { ethers }) => {
        const [signer] = await ethers.getSigners()
        const contract = taskArgs.contract
        const proposalId = taskArgs.proposalId
        const agreement = taskArgs.agreement
        const gisDaoVoting = new ethers.Contract(
            contract,
            abi,
            signer
        )

        const tx = await gisDaoVoting.vote(proposalId, agreement)
        console.log(tx)
    })