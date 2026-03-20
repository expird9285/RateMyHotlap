import os
import boto3
from botocore.config import Config
from tempfile import SpooledTemporaryFile

OCI_NAMESPACE = os.getenv("OCI_NAMESPACE")
OCI_REGION = "ap-northeast-2"  # 하드코딩 또는 환경변수 처리
OCI_ACCESS_KEY = os.getenv("OCI_ACCESS_KEY")
OCI_SECRET_KEY = os.getenv("OCI_SECRET_KEY")
OCI_BUCKET_NAME = os.getenv("OCI_BUCKET_NAME", "ratemyhotlap-raw")

s3_client = None

if all([OCI_NAMESPACE, OCI_ACCESS_KEY, OCI_SECRET_KEY]):
    endpoint_url = f"https://{OCI_NAMESPACE}.compat.objectstorage.{OCI_REGION}.oraclecloud.com"
    s3_client = boto3.client(
        's3',
        region_name=OCI_REGION,
        endpoint_url=endpoint_url,
        aws_access_key_id=OCI_ACCESS_KEY,
        aws_secret_access_key=OCI_SECRET_KEY,
        config=Config(s3={'addressing_style': 'path'})
    )

def upload_file_to_oci(file_data: bytes, object_key: str, content_type: str = "application/octet-stream") -> str:
    """Uploads bytes to OCI Object storage and returns the object key."""
    if not s3_client:
        raise ValueError("S3 client is not configured.")
        
    s3_client.put_object(
        Bucket=OCI_BUCKET_NAME,
        Key=object_key,
        Body=file_data,
        ContentType=content_type
    )
    return object_key
