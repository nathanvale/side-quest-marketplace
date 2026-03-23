# node-cert cert-info

Display details about a certificate file.

## Usage

```
/node-cert:cert-info [file]
```

## Arguments

- `file` - Path to PEM certificate (default: ~/CAFile.pem or NODE_EXTRA_CA_CERTS)

## Instructions

Run the cert-info script at `scripts/cert-info.sh` which displays:

- **Subject** - Who the certificate is for (CN, O, etc.)
- **Issuer** - Who signed the certificate
- **Self-signed check** - Subject == Issuer means root CA
- **Validity dates** - When it becomes valid and expires
- **Expiry status** - Valid, expired, or expiring soon
- **Certificate type** - CA certificate or end-entity
- **Key algorithm** - RSA, ECDSA, etc.
- **Key size** - 2048-bit, 4096-bit, etc.
- **SHA-256 fingerprint** - Unique identifier
- **Serial number** - Certificate serial
- **File info** - Path, size, certificate count

## Example Output

```
[INFO] Reading: /Users/you/CAFile.pem

Subject:
  CN = YourCompany Root CA, O = YourCompany Inc

Issuer:
  CN = YourCompany Root CA, O = YourCompany Inc
  (Self-signed - this is a ROOT CA)

Validity:
  From:  Jan  1 00:00:00 2024 GMT
  Until: Dec 31 23:59:59 2026 GMT
  STATUS: Valid (698 days remaining)

Certificate Type:
  CA Certificate (can sign other certificates)

Key:
  Algorithm: rsaEncryption
  Size: (4096 bit)

Fingerprint (SHA-256):
  A1:B2:C3:D4:E5:F6:...

Serial Number:
  01234567890ABCDEF

File:
  Path: /Users/you/CAFile.pem
  Size: 1842 bytes
  Contains 1 certificate
```

## Common Issues

- **"NOT self-signed"** - You may have an intermediate CA, not root. Re-extract.
- **"EXPIRED"** - Certificate has expired. Re-extract with `/node-cert:extract-cert`.
- **"Contains N certificates"** - Bundle file; first cert details shown.
