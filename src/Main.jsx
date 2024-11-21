import { DynamicWidget, useIsLoggedIn, useDynamicContext, dynamicEvents } from "@dynamic-labs/sdk-react-core";
import { useState, useEffect } from "react";
import DynamicMethods from "./Methods.js";
import "./Main.css";
import {
  createSmartAccountClient,
  walletClientToSmartAccountSigner,
} from "permissionless";
import { toEcdsaKernelSmartAccount } from "permissionless/accounts";
import { http } from "viem";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";
import { parseEther } from "viem";
import { isEthereumWallet } from "@dynamic-labs/ethereum";

const checkIsDarkSchemePreferred = () =>
  window?.matchMedia?.("(prefers-color-scheme:dark)")?.matches ?? false;

const Main = () => {
  const isLoggedIn = useIsLoggedIn();
  const { primaryWallet } = useDynamicContext();
  const [isDarkMode, setIsDarkMode] = useState(checkIsDarkSchemePreferred);
  const [selectedNetwork, setSelectedNetwork] = useState(null); // Chain ID of the selected network
  const [publicClient, setPublicClient] = useState(null);
  const [smartAccountClient, setSmartAccountClient] = useState(null);
  const [kernelAccount, setKernelAccount] = useState(null);
  const [disableSendTransaction, setDisableSendTransaction] = useState(true);
  const [disableInitializeClients, setDisableInitializeClients] = useState(false);
  const [sendingTransaction, setSendingTransaction] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const API_KEY = process.env.REACT_APP_PIMLICO_API_KEY;

  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setIsDarkMode(checkIsDarkSchemePreferred());
    darkModeMediaQuery.addEventListener("change", handleChange);
    return () => darkModeMediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    dynamicEvents.on("primaryWalletChanged", (newPrimaryWallet) => {
      console.log("primaryWalletChanged was called", newPrimaryWallet);
    });

    dynamicEvents.on("primaryWalletNetworkChanged", (newNetwork) => {
      console.log("primaryWalletNetworkChanged was called", newNetwork);
      setSelectedNetwork(newNetwork);
      console.log("Selected network updated:", newNetwork);
    });
  }, []);

  const initializeClients = async () => {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
      console.error("No valid wallet found!");
      return;
    }

    try {
      console.log("Initializing clients...");
      setDisableInitializeClients(true); // Disable button during initialization

      // Initialize the public client
      const publicC = await primaryWallet.getPublicClient();
      const walletClient = await primaryWallet.getWalletClient();
      setPublicClient(publicC);

      // Initialize Pimlico client
      const pimlicoUrl = `https://api.pimlico.io/v2/${selectedNetwork}/rpc?apikey=${API_KEY}`;
      const pimlicoClient = createPimlicoClient({
        chain: selectedNetwork,
        transport: http(pimlicoUrl),
        entryPoint: {
          address: entryPoint07Address,
          version: "0.7", // Kernel version
        },
      });

      const kernelSmartAccount = await toEcdsaKernelSmartAccount({
        owners: [walletClient],
        client: publicC,
        entryPoint: {
          address: entryPoint07Address,
          version: "0.7",
        },
      });

      console.log("Kernel smart account:", kernelSmartAccount);

      // Initialize the smart account client
      const smartClient = createSmartAccountClient({
        account: kernelSmartAccount,
        chain: selectedNetwork,
        bundlerTransport: http(pimlicoUrl),
        paymasterContext: {
          sponsorshipPolicyId: "sp_cynical_speed",
        },
        userOperation: {
          estimateFeesPerGas: async () =>
            (await pimlicoClient.getUserOperationGasPrice()).fast, // Using Pimlico bundlers
        },
      });

      console.log("Smart account client initialized:", smartClient);

      setSmartAccountClient(smartClient);
      setKernelAccount(kernelSmartAccount);
      setDisableSendTransaction(false); // Enable the transaction button
    } catch (error) {
      console.error("Error initializing clients:", error);
      alert("Failed to initialize clients. Please try again.");
      setDisableInitializeClients(false); // Re-enable if initialization fails
    }
  };

  const handleSendTransaction = async () => {
    if (!smartAccountClient || !kernelAccount) {
      console.error("SmartAccountClient or KernelAccount is not initialized!");
      return;
    }

    try {
      setSendingTransaction(true); // Show the spinner

      const transaction = {
        to: toAddress, // Recipient address
        value: parseEther("0.0001"), // 0.0001 ETH
        data: "0x", // No calldata
      };

      console.log("Sending transaction:", transaction);

      // Send transaction
      const txHash = await smartAccountClient.sendTransaction(transaction);
      console.log("Transaction sent! Hash:", txHash);

      // Wait for transaction receipt (optional)
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log("Transaction receipt:", receipt);
      alert(`Transaction sent successfully! Hash: ${txHash}`);
    } catch (error) {
      console.error("Error sending transaction:", error);
      alert("Failed to send transaction. Please try again.");
    } finally {
      setSendingTransaction(false); // Stop the spinner
      setDisableInitializeClients(false); // Re-enable the initialize button
    }
  };

  return (
    <div className={`container ${isDarkMode ? "dark" : "light"}`}>
      <header className="header">
        <img
          className="logo"
          src={isDarkMode ? "/logo-light.png" : "/logo-dark.png"}
          alt="Dynamic Logo"
        />
        <div className="header-buttons">
          <button
            className="btn docs-button"
            onClick={() => window.open("https://docs.dynamic.xyz", "_blank", "noopener,noreferrer")}
          >
            Docs
          </button>
          <button
            className="btn get-started"
            onClick={() => window.open("https://app.dynamic.xyz", "_blank", "noopener,noreferrer")}
          >
            Get Started
          </button>
        </div>
      </header>

      <main className="modal">
        <DynamicWidget />
        <DynamicMethods isDarkMode={isDarkMode} />

        {isLoggedIn ? (
          <div className="user-actions">
            <p className="network-label">
              <b>Selected Network: {selectedNetwork || ""}</b>
            </p>

            <label htmlFor="toAddress" className="network-label">
              <b>Enter To Address:</b>
            </label>
            <input
              id="toAddress"
              className="user-actions"
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="Enter To Address"
            />
            <br />
            <button
              className="btn btn-primary"
              onClick={initializeClients}
              disabled={disableInitializeClients}
            >
              Initialize Clients
            </button>
            <br />

            {sendingTransaction ? (
              <div className="spinner">
                <span>Sending transaction...</span>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleSendTransaction}
                disabled={disableSendTransaction}
              >
                Send Sponsored Transaction
              </button>
            )}
          </div>
        ) : (
          <p className="login-prompt">Please log in to get started.</p>
        )}
      </main>

      <footer className="footer">
        <p className="footer-text">Made with ❤️ by Dynamic</p>
        <img
          className="footer-image"
          src={isDarkMode ? "/image-dark.png" : "/image-light.png"}
          alt="Dynamic Footer"
        />
      </footer>
    </div>
  );
};

export default Main;