//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";
/**
    @title A DAO voting smart-contract
    @author Ildar Galiullin S.
    @notice Not for production use!
    @custom:experimental This is an experimental contract.
 */
contract GisDAOVoting is Ownable{
    using Counters for Counters.Counter;
    Counters.Counter private currentProposalId;

    uint256 public minimumQuorumPercent;
    uint256 public debatingPeriodDuration;
    address public chairman;
    IERC20 public token;
    
    mapping(uint256 => Proposal) proposals;
    mapping(address => UserInfo) voters;
    mapping(address => mapping(uint256 => bool)) isProposalVoted;

    struct UserInfo{
        uint256 deposit;
        uint256 withdrawAfter;
    }

    struct Proposal{
        uint256 startAt;
        uint256 stopAt;
        uint256 posQuorum;
        uint256 negQuorum;
        bytes callData;
        string description;
        address recipient;
        bool isFinished;
    }

    event ProposalAdded(
        bytes callData,
        address recipient,
        string description
    );

    event ProposalVoted(
        address voter,
        uint256 proposalId,
        bool agreement
    );

    event ProposalFinished(
        uint256 proposalId
    );

    /**
        @notice The constructor receives four arguments
        @param _chairman The address of the chairman
        @param _token The address of the ERC20 token which will be used for manipulation 
        @param _minimumQuorumPercent The minimum percent of the used tokens in voting
        @param _debatingPeriodDuration The voting duration. 
     */
    constructor(address _chairman, address _token, uint256 _minimumQuorumPercent, uint256 _debatingPeriodDuration){
        token = IERC20(_token);
        chairman = _chairman;
        minimumQuorumPercent = _minimumQuorumPercent;
        debatingPeriodDuration = _debatingPeriodDuration;
    }

    /**
        @notice The function for deposit tokens to participate in voting
        @param _amount The amount of the tokens to deposit. The tokens will charge from the balance of the msg.sender.
     */
    function deposit(uint256 _amount) public {
        token.transferFrom(msg.sender, address(this), _amount);
        unchecked {
            voters[msg.sender].deposit += _amount;            
        }
    }

    /**
        @notice The function for adding proposal by chairman
        @param _callData The signature for call on the other contract
        @param _recipient The address of the other contract
        @param _description The proposal description.
     */
    function addProposal(bytes memory _callData, address _recipient, string memory _description) public {
        require(msg.sender == chairman, "you are not the chairman");
        require(_callData.length > 0 && _recipient != address(0), "incorrect params");
        Proposal memory proposal = Proposal(
            block.timestamp,
            block.timestamp + debatingPeriodDuration,
            0,
            0,
            _callData,
            _description,
            _recipient,
            false
        );
        currentProposalId.increment();
        proposals[currentProposalId.current()] = proposal;
        emit ProposalAdded(_callData, _recipient, _description);
    }

    /**
        @notice Vote for proposal
        @param _proposalId The proposal ID
        @param _agreement true or false for proposal. (True - agree, false - not agree).
     */
    function vote(uint256 _proposalId, bool _agreement) public {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.stopAt > block.timestamp, "proposal is not active");
        require(voters[msg.sender].deposit > 0, "you don't have deposit for vote");
        require(isProposalVoted[msg.sender][_proposalId] == false, "you already had voted");
        isProposalVoted[msg.sender][_proposalId] = true;
        if (voters[msg.sender].withdrawAfter < proposal.stopAt){
            voters[msg.sender].withdrawAfter = proposal.stopAt;
        }
        if (_agreement){
            unchecked {
                proposal.posQuorum += voters[msg.sender].deposit;                
            }
        } else {
            unchecked {
                proposal.negQuorum += voters[msg.sender].deposit;
            }
        }
        emit ProposalVoted(msg.sender, _proposalId, _agreement);
    }

    /**
        @notice Finish the proposal
        @param _proposalId The proposal ID.
     */
    function finish(uint256 _proposalId) public {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.isFinished == false, "proposal is finished");
        require(proposal.stopAt < block.timestamp, "proposal is in progress");
        uint256 daoBalance = token.balanceOf(address(this));
        require((proposal.posQuorum + proposal.negQuorum) > (daoBalance * (minimumQuorumPercent / 100)), "minimal quorum not reached");
        if (proposal.posQuorum > proposal.negQuorum){
            (bool success, bytes memory result) = proposal.recipient.call(proposal.callData);
            require(success, string(abi.encodePacked("upstream error: ", string(result))));
            proposal.isFinished = true;
            emit ProposalFinished(_proposalId);
        } else {
            revert("not enough positive votes");
        }  
    }

    /**
        @notice Withdraw deposit from the contract
        @param _amount The amount of the tokens to withdraw.
     */
    function withdrawDeposit(uint256 _amount) public {
        require(voters[msg.sender].withdrawAfter < block.timestamp, "you have a vote in active proposal");
        require(voters[msg.sender].deposit >= _amount, "incorrect amount");
        token.transfer(msg.sender, _amount);
        unchecked {
            voters[msg.sender].deposit -= _amount;
        }
    }

    /**
        @notice Change the chairman
        @param _newChairman New chairman address
     */
    function setChairman(address _newChairman) public onlyOwner {
        require(_newChairman != address(0), "incorrect address");
        chairman = _newChairman;
    }

    /**
        @notice Change the minimum quorum percent
        @param _newQuorumPercent New quorum percent value
     */
    function setMinimumQuorum(uint256 _newQuorumPercent) public onlyOwner {
        require(_newQuorumPercent != 0, "incorrect value");
        minimumQuorumPercent = _newQuorumPercent;
    }

    /**
        @notice Change debating period duration
        @param _newDebatingPeriodDuration New debating period duration
    */
    function setDebatingPeriodDuration(uint256 _newDebatingPeriodDuration) public onlyOwner {
        require(_newDebatingPeriodDuration != 0, "incorrect value");
        debatingPeriodDuration = _newDebatingPeriodDuration;
    }

    /**
        @notice Get voter by address
        @param _voterAddr The address of the voter.
    */
    function getVoterByAddress(address _voterAddr) public view returns(UserInfo memory){
        return voters[_voterAddr];
    }

    /**
        @notice Get proposal by ID
        @param _proposalId The ID of the proposal.
    */
    function getProposalById(uint256 _proposalId) public view returns(Proposal memory){
        return proposals[_proposalId];
    }
}