import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";

describe("GisDAOVoting", () => {
    let owner: SignerWithAddress
    let account1: SignerWithAddress
    let account2: SignerWithAddress
    let account3: SignerWithAddress
    let chairman: SignerWithAddress
    let gisDaoVoting: Contract
    let erc20Token: Contract

    const debatingPeriodDuration = 60 * 60 * 24
    const minimumQuorumPercent = 50
    const erc20MintAmount = 10000

    async function addProposal(recipient = erc20Token.address, description = "some info") {
        const calldata = getCalldata()
        await gisDaoVoting.connect(chairman).addProposal(calldata, recipient, description)
    }

    function getCalldata(){
        const iface = new ethers.utils.Interface([
            "function transfer(address account, uint256 amount)"
        ])

        const calldata = iface.encodeFunctionData("transfer", [account3.address, 2000])
        return calldata
    }

    beforeEach(async () => {
        [owner, account1, account2, account3, chairman] = await ethers.getSigners()
        
        const GisERC20Token = await ethers.getContractFactory("GisToken", owner)
        erc20Token = await GisERC20Token.deploy("TokenName", "TokenSymbol")
        await erc20Token.deployed()

        const GisDAOVoting = await ethers.getContractFactory("GisDAOVoting", owner)
        gisDaoVoting = await GisDAOVoting.deploy(chairman.address, erc20Token.address, minimumQuorumPercent, debatingPeriodDuration)
        await gisDaoVoting.deployed()

        await erc20Token.connect(account1).approve(gisDaoVoting.address, 10000000)
        await erc20Token.connect(account2).approve(gisDaoVoting.address, 10000000)
        await erc20Token.connect(account3).approve(gisDaoVoting.address, 10000000)
        await erc20Token.mint(account1.address, erc20MintAmount)
        await erc20Token.mint(account2.address, erc20MintAmount)
        await erc20Token.mint(account3.address, erc20MintAmount)
    })

    it("deposit tokens to dao", async () => {
        await gisDaoVoting.connect(account1).deposit(5000)
        expect(await erc20Token.balanceOf(account1.address)).to.eq(erc20MintAmount - 5000)
        expect(await erc20Token.balanceOf(gisDaoVoting.address)).to.eq(5000)
        const [deposit] = await gisDaoVoting.getVoterByAddress(account1.address)
        expect(deposit).to.eq(5000)
    })

    it("add proposal reverts", async () => {
        const calldata = getCalldata()
        await expect(gisDaoVoting.addProposal(calldata, erc20Token.address, "Mint tokens to account3")).to.be.revertedWith("you are not the chairman")
        await expect(gisDaoVoting.connect(chairman).addProposal(calldata, ethers.constants.AddressZero, "some info")).to.be.revertedWith("incorrect params")
    })

    it("add proposal to dao", async () => {
        await addProposal()
        const [startAt, stopAt, posQuorum, negQuorum, callData, description, recipient, isFinished] = await gisDaoVoting.getProposalById(1)

        expect(recipient).to.eq(erc20Token.address)
    })

    it("vote for proposal reverts", async () => {
        await addProposal()

        await expect(gisDaoVoting.connect(account1).vote(1, true)).to.be.revertedWith("you don't have deposit for vote")
        await expect(gisDaoVoting.connect(account1).vote(2, true)).to.be.revertedWith("proposal is not active")

        await gisDaoVoting.connect(account1).deposit(5000)
        await gisDaoVoting.connect(account1).vote(1, true)
        await expect(gisDaoVoting.connect(account1).vote(1, true)).to.be.revertedWith("you already had voted")
    })

    it("vote for proposal", async () => {
        await addProposal()
        await gisDaoVoting.connect(account1).deposit(5000)
        await gisDaoVoting.connect(account2).deposit(2500)

        await gisDaoVoting.connect(account1).vote(1, true)
        await gisDaoVoting.connect(account2).vote(1, false)

        const [startAt, stopAt, posQuorum, negQuorum, callData, description, recipient, isFinished] = await gisDaoVoting.getProposalById(1)
        expect(posQuorum).to.eq(5000)
        expect(negQuorum).to.eq(2500)
    })

    it("finish reverts", async () => {
        await addProposal()
        await gisDaoVoting.connect(account1).deposit(5000)
        await gisDaoVoting.connect(account2).deposit(2500)

        await gisDaoVoting.connect(account1).vote(1, true)
        await gisDaoVoting.connect(account2).vote(1, false)

        await expect(gisDaoVoting.finish(1)).to.be.revertedWith("proposal is in progress")

        await addProposal()
        await gisDaoVoting.connect(account1).deposit(2500)
        await gisDaoVoting.connect(account2).deposit(1000)

        await ethers.provider.send(
                "evm_increaseTime",
                [debatingPeriodDuration + 1000]
            );

        await expect(gisDaoVoting.finish(2)).to.be.revertedWith("minimal quorum not reached")
        
        const iface = new ethers.utils.Interface([
            "function mint(address account, uint256 amount)"
        ])

        const calldata = iface.encodeFunctionData("mint", [account3.address, 2000])
        await gisDaoVoting.connect(chairman).addProposal(calldata, erc20Token.address, "some info")

        await gisDaoVoting.connect(account1).vote(3, true)
        await gisDaoVoting.connect(account2).vote(3, false)

        await ethers.provider.send(
            "evm_increaseTime",
            [debatingPeriodDuration + 1000]
        );

        await expect(gisDaoVoting.finish(3)).to.be.reverted

        await addProposal()

        await gisDaoVoting.connect(account1).vote(4, false)
        await gisDaoVoting.connect(account2).vote(4, true)

        await ethers.provider.send(
            "evm_increaseTime",
            [debatingPeriodDuration + 1000]
        );

        await expect(gisDaoVoting.finish(4)).to.be.revertedWith("not enough positive votes")
    })

    it("finish proposal", async () => {
        await addProposal()
        await gisDaoVoting.connect(account1).deposit(5000)
        await gisDaoVoting.connect(account2).deposit(2500)

        await gisDaoVoting.connect(account1).vote(1, true)
        await gisDaoVoting.connect(account2).vote(1, false)

        await ethers.provider.send(
            "evm_increaseTime",
            [debatingPeriodDuration + 1000]
        );

        await gisDaoVoting.finish(1)
        expect(await erc20Token.balanceOf(account3.address)).to.eq(erc20MintAmount + 2000)

        await expect(gisDaoVoting.finish(1)).to.be.revertedWith("proposal is finished")
    })

    it("withdraw deposit reverts", async () => {
        await addProposal()
        await gisDaoVoting.connect(account1).deposit(5000)

        await gisDaoVoting.connect(account1).vote(1, true)

        await expect(gisDaoVoting.connect(account1).withdrawDeposit(1000)).to.be.revertedWith("you have a vote in active proposal")
        
        await ethers.provider.send(
            "evm_increaseTime",
            [debatingPeriodDuration + 1000]
        );

        await expect(gisDaoVoting.connect(account1).withdrawDeposit(6000)).to.be.revertedWith("incorrect amount")
    })

    it("withdraw deposit", async () => {
        await addProposal()
        await gisDaoVoting.connect(account1).deposit(5000)

        await gisDaoVoting.connect(account1).vote(1, true)
        
        await ethers.provider.send(
            "evm_increaseTime",
            [debatingPeriodDuration + 1000]
        );

        await gisDaoVoting.connect(account1).withdrawDeposit(4000)
        expect(await erc20Token.balanceOf(account1.address)).to.eq(erc20MintAmount - 1000)
        expect(await erc20Token.balanceOf(gisDaoVoting.address)).to.eq(1000)
        const [deposit] = await gisDaoVoting.getVoterByAddress(account1.address)
        expect(deposit).to.eq(1000)
    })

    it("set chairman", async () => {
        await expect(gisDaoVoting.setChairman(ethers.constants.AddressZero)).to.be.revertedWith("incorrect address")
        await gisDaoVoting.setChairman(account2.address)
        expect(await gisDaoVoting.chairman()).to.eq(account2.address)
    })

    it("set minimum quorum percent", async () => {
        await expect(gisDaoVoting.setMinimumQuorum(0)).to.be.revertedWith("incorrect value")
        await gisDaoVoting.setMinimumQuorum(70)
        expect(await gisDaoVoting.minimumQuorumPercent()).to.eq(70)
    })

    it("set debating period duration", async () => {
        await expect(gisDaoVoting.setDebatingPeriodDuration(0)).to.be.revertedWith("incorrect value")
        await gisDaoVoting.setDebatingPeriodDuration(3600)
        expect(await gisDaoVoting.debatingPeriodDuration()).to.eq(3600)
    })

})