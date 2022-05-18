import hre from 'hardhat';
import "dotenv/config";

const ethers = hre.ethers

const erc20TokenAddr = process.env.ERC20_TOKEN_ADDR
const minimumQuorumPercent = process.env.MINIMUM_QUORUM_PERCENT
const debatingPeriodDuration = process.env.DEBATING_PERIOD_DURATION

async function main() {
    const [signer] = await ethers.getSigners()
    const chairmanAddr = signer.address
    const GisDAOVoting = await ethers.getContractFactory('GisDAOVoting', signer)
    const gisDaoVoting = await GisDAOVoting.deploy(chairmanAddr, erc20TokenAddr, minimumQuorumPercent, debatingPeriodDuration)
    await gisDaoVoting.deployed()
    console.log(gisDaoVoting.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });