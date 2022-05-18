import { task } from 'hardhat/config'
import { abi } from '../artifacts/contracts/GisDAOVoting.sol/GisDAOVoting.json'


task("addProposal", "Add proposal to DAO (only chairman)")
    .addParam("contract", "Contract address")
    .addParam("calldata", "The signaure to call on the other contract(bytes array)")
    .addParam("recipient", "The address of the contract to call signature")
    .addParam("description", "The proposal description")
    .setAction(async (taskArgs, { ethers }) => {
        const [signer] = await ethers.getSigners()
        const contract = taskArgs.contract
        const calldata = taskArgs.calldata
        const recipient = taskArgs.recipient
        const description = taskArgs.description
        const gisDaoVoting = new ethers.Contract(
            contract,
            abi,
            signer
        )

        const tx = await gisDaoVoting.addProposal(calldata, recipient, description)
        console.log(tx)
    })